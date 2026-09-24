import test from 'node:test';
import assert from 'node:assert/strict';
import { filterCourseResources, isCourseResource, matchesCourseSection, topicResourceTypes } from '../../lib/resource-placement.ts';
import { validateCreateSubmissionRequest } from '../../lib/server/api/validation.ts';

test('course categories collect legacy materials and exclude them from topic resources', () => {
  const expected = { study_material: 'notes', practice_material: 'notes', book: 'books', slide: 'slides' };
  for (const [type, section] of Object.entries(expected)) {
    assert.equal(isCourseResource(type), true);
    for (const candidate of ['notes', 'books', 'slides', 'resources']) {
      assert.equal(matchesCourseSection(type, candidate), candidate === section);
    }
    assert.equal(topicResourceTypes.includes(type), false);
  }
  for (const type of topicResourceTypes) {
    assert.equal(isCourseResource(type), false);
    assert.equal(matchesCourseSection(type, 'resources'), true);
  }
});

test('submission descriptions are optional while title, types, and length remain validated', () => {
  const input = { resourceType: 'study_material', title: 'Course notes', courseId: '00000000-0000-4000-8000-000000000401', topicId: '00000000-0000-4000-8000-000000000501' };
  for (const description of [undefined, '', '   ']) {
    assert.equal(validateCreateSubmissionRequest({ ...input, description }).description, '');
  }
  assert.equal(validateCreateSubmissionRequest({ ...input, description: ' Notes ' }).description, 'Notes');
  for (const description of [null, 1, {}, 'x'.repeat(5001)]) {
    assert.throws(() => validateCreateSubmissionRequest({ ...input, description }));
  }
  assert.throws(() => validateCreateSubmissionRequest({ ...input, title: '' }));
});

test('course filters combine section, topic, type and search without leaking other categories', () => {
  const resources = [
    { type: 'book', topicId: 'arrays', title: 'Algorithms', description: 'Array exercises' },
    { type: 'slide', topicId: 'arrays', title: 'Lecture slides', description: '' },
    { type: 'study_material', topicId: 'arrays', title: 'Notes', description: '' },
    { type: 'practice_material', topicId: 'graphs', title: 'Legacy notes', description: '' },
    { type: 'leetcode_problem', topicId: 'arrays', title: 'Two sum', description: 'Array exercises' },
    { type: 'leetcode_problem', topicId: 'graphs', title: 'Paths', description: '' },
    { type: 'question', topicId: 'arrays', title: 'Exam', description: 'Array exercises' },
  ];
  const empty = { topicId: '', type: '', search: '' };
  assert.deepEqual(filterCourseResources(resources, 'resources', { topicId: 'arrays', type: 'leetcode_problem', search: '  ARRAY  ' }), [resources[4]]);
  assert.deepEqual(filterCourseResources(resources, 'books', { ...empty, search: 'exercises' }), [resources[0]]);
  assert.deepEqual(filterCourseResources(resources, 'slides', { ...empty, topicId: 'arrays' }), [resources[1]]);
  assert.deepEqual(filterCourseResources(resources, 'notes', { ...empty, topicId: 'graphs' }), [resources[3]]);
  assert.deepEqual(filterCourseResources(resources, 'notes', empty), resources.slice(2, 4));
  assert.deepEqual(filterCourseResources(resources, 'resources', empty), resources.slice(4));
  assert.deepEqual(filterCourseResources(resources, 'books', { ...empty, topicId: 'graphs' }), []);
  assert.deepEqual(filterCourseResources(resources, 'resources', { ...empty, search: 'absent' }), []);
});
