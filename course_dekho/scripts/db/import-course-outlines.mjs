import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { resolveDatabaseUrl } from './migration-utils.mjs';

// Targeted academic-data import; does not run the demo seed or publish resources.
const allOutlines = JSON.parse(await readFile(new URL('../../data/course-outlines.json', import.meta.url), 'utf8'));
const requestedCode = process.argv[2];
const outlines = requestedCode ? allOutlines.filter(course => course.code === requestedCode) : allOutlines;
if (!outlines.length) throw new Error(`Unknown course: ${requestedCode}`);
const semesterFor = course => course.semester ?? { level: 1, term: course.code === 'CSE-107' ? 2 : 1 };
const slug = value => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replaceAll('\u03b5', 'epsilon').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const client = new pg.Client({ connectionString: await resolveDatabaseUrl(new URL('../../', import.meta.url)) });
await client.connect();
try {
  await client.query('BEGIN');
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended('coursedekho:database-change', 0))");
  const university = (await client.query("SELECT id FROM coursedekho.university WHERE slug = 'buet' AND is_active")).rows[0];
  if (!university) throw new Error('Active BUET university not found');
  const semesters = new Map();
  const destinations = outlines.map(semesterFor);
  if (!requestedCode) destinations.push({ level: 1, term: 2 });
  for (const { level, term } of destinations) {
    const semesterSlug = `level-${level}-term-${term}`;
    await client.query(`INSERT INTO coursedekho.semester (university_id, slug, name, sequence_order)
      VALUES ($1, $2, $3, $4) ON CONFLICT (university_id, slug) DO NOTHING`, [university.id, semesterSlug, `Level ${level}, Term ${term}`, (level - 1) * 2 + term]);
    const semester = (await client.query('SELECT id FROM coursedekho.semester WHERE university_id = $1 AND slug = $2 AND is_active', [university.id, semesterSlug])).rows[0];
    if (!semester) throw new Error('Active destination semester not found');
    semesters.set(semesterSlug, semester);
  }
  const summary = [];
  if (!requestedCode) {
    const dsa = (await client.query(`SELECT id, public_id FROM coursedekho.course
      WHERE university_id = $1 AND slug = 'data-structures-and-algorithms' AND is_active FOR UPDATE`, [university.id])).rows[0];
    if (!dsa) throw new Error('Existing DSA course not found');
    await client.query("UPDATE coursedekho.course SET semester_id = $1, code = 'CSE-105', updated_at = now() WHERE id = $2", [semesters.get('level-1-term-2').id, dsa.id]);
    summary.push({ code: 'CSE-105', publicId: dsa.public_id, semester: 'Level 1, Term 2', action: 'Moved existing DSA course; retained its identity and content' });
  }
  for (const course of outlines) {
    const { level, term } = semesterFor(course);
    const semester = semesters.get(`level-${level}-term-${term}`);
    if (!Array.isArray(course.topics)) throw new Error('Course topics must be an array');
    // Abort on a conflicting existing course instead of overwriting its roadmap.
    let existing = (await client.query("SELECT * FROM coursedekho.course WHERE university_id = $1 AND regexp_replace(code, '[^A-Z0-9]', '', 'g') = $2", [university.id, course.code.replaceAll('-', '')])).rows;
    if (existing.length > 1) throw new Error(`Ambiguous course: ${course.code}`);
    let saved = existing[0];
    if (!saved) {
      saved = (await client.query(`INSERT INTO coursedekho.course (university_id, semester_id, slug, code, name, description)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`, [university.id, semester.id, slug(course.name), course.code, course.name, course.description])).rows[0];
    }
    if (saved.semester_id !== semester.id || saved.name !== course.name || saved.description !== course.description || !saved.is_active) {
      throw new Error(`Existing ${course.code} differs from the requested outline; no changes applied`);
    }
    for (const [index, topic] of course.topics.entries()) {
      const savedTopic = (await client.query(`INSERT INTO coursedekho.topic (course_id, slug, name, description, sequence_order)
        VALUES ($1, $2, $3, $4, $5) ON CONFLICT (course_id, slug) DO NOTHING RETURNING id`, [saved.id, slug(topic.name), topic.name, topic.description, index + 1])).rows[0]
        ?? (await client.query('SELECT id FROM coursedekho.topic WHERE course_id = $1 AND slug = $2', [saved.id, slug(topic.name)])).rows[0];
      for (const [subIndex, title] of topic.subtopics.entries()) {
        await client.query(`INSERT INTO coursedekho.topic_subtopic (topic_id, slug, title, sequence_order)
          VALUES ($1, $2, $3, $4) ON CONFLICT (topic_id, slug) DO NOTHING`, [savedTopic.id, slug(title), title, subIndex + 1]);
      }
    }
    const actual = (await client.query(`SELECT t.name, t.description, t.sequence_order, t.is_active,
        COALESCE(jsonb_agg(jsonb_build_object('title', s.title, 'position', s.sequence_order, 'active', s.is_active)
          ORDER BY s.sequence_order) FILTER (WHERE s.id IS NOT NULL), '[]') AS subtopics
      FROM coursedekho.topic t LEFT JOIN coursedekho.topic_subtopic s ON s.topic_id = t.id
      WHERE t.course_id = $1 GROUP BY t.id ORDER BY t.sequence_order`, [saved.id])).rows;
    const expected = course.topics.map((t, i) => ({ name: t.name, description: t.description, sequence_order: i + 1, is_active: true,
      subtopics: t.subtopics.map((title, j) => ({ title, position: j + 1, active: true })) }));
    // Compare fields explicitly because JSONB object key order is not significant.
    if (actual.length !== expected.length || actual.some((t, i) => t.name !== expected[i].name || t.description !== expected[i].description || t.sequence_order !== expected[i].sequence_order || !t.is_active || t.subtopics.length !== expected[i].subtopics.length || t.subtopics.some((s, j) => s.title !== expected[i].subtopics[j].title || s.position !== j + 1 || !s.active))) {
      throw new Error(`Verification failed for ${course.code}; no changes applied`);
    }
    summary.push({ code: course.code, publicId: saved.public_id, semester: `Level ${level}, Term ${term}`, modules: actual.length, subtopics: actual.reduce((sum, t) => sum + t.subtopics.length, 0) });
  }
  await client.query('COMMIT');
  console.log(JSON.stringify({ university: 'BUET', courses: summary }, null, 2));
} catch (error) {
  await client.query('ROLLBACK');
  console.error(error instanceof Error ? error.message : 'Course import failed');
  process.exitCode = 1;
} finally {
  await client.end();
}
