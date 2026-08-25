/**
 * lib/data/users.ts
 * ------------------------------------------------------------------
 * Mock "users" table.
 *
 * This stands in for the User + Student/Teacher/Admin tables from the
 * ERD. There is ONE demo account per role so you can log in and show
 * all three permission levels during your presentation:
 *
 *   Student -> username: rafiul   password: student123
 *   Teacher -> username: sharif   password: teacher123
 *   Admin   -> username: nusrat   password: admin123
 * ------------------------------------------------------------------
 */
import { AppUser } from "@/lib/types";

export const users: AppUser[] = [
  {
    id: "u-student-1",
    name: "Rafiul Islam",
    username: "rafiul",
    email: "rafiul.islam@student.buet.ac.bd",
    password: "student123",
    role: "student",
    avatarInitials: "RI",
    universityId: "buet",
    department: "CSE",
    yearOfStudy: "3rd Year",
  },
  {
    id: "u-teacher-1",
    name: "Sharif Ahmed",
    username: "sharif",
    email: "sharif.ahmed@buet.ac.bd",
    password: "teacher123",
    role: "teacher",
    avatarInitials: "SA",
    universityId: "buet",
    designation: "Lecturer, Dept. of CSE",
  },
  {
    id: "u-admin-1",
    name: "Nusrat Jahan",
    username: "nusrat",
    email: "nusrat.jahan@coursedekho.app",
    password: "admin123",
    role: "admin",
    avatarInitials: "NJ",
    designation: "Platform Administrator",
  },
  // A couple of extra teachers referenced as "Added By" / "Submitted By" on
  // various resources & submissions, so the data feels like a real, shared
  // platform rather than a one-person demo.
  {
    id: "u-teacher-2",
    name: "Tahmid Hasan",
    username: "tahmid",
    email: "tahmid.hasan@buet.ac.bd",
    password: "teacher123",
    role: "teacher",
    avatarInitials: "TH",
    universityId: "buet",
    designation: "Professor, Dept. of CSE",
  },
  {
    id: "u-teacher-3",
    name: "Amit Kumar",
    username: "amit",
    email: "amit.kumar@buet.ac.bd",
    password: "teacher123",
    role: "teacher",
    avatarInitials: "AK",
    universityId: "buet",
    designation: "Assistant Professor, Dept. of CSE",
  },
  {
    id: "u-teacher-4",
    name: "Rahan Uddin",
    username: "rahan",
    email: "rahan.uddin@buet.ac.bd",
    password: "teacher123",
    role: "teacher",
    avatarInitials: "RU",
    universityId: "buet",
    designation: "Lecturer, Dept. of CSE",
  },
  {
    id: "u-teacher-5",
    name: "M. S. Islam",
    username: "msislam",
    email: "ms.islam@buet.ac.bd",
    password: "teacher123",
    role: "teacher",
    avatarInitials: "MI",
    universityId: "buet",
    designation: "Lecturer, Dept. of CSE",
  },
];

/** Small helper list used by the login page to show quick "demo login" buttons. */
export const demoAccounts = [
  { role: "student" as const, username: "rafiul", password: "student123", label: "Student demo" },
  { role: "teacher" as const, username: "sharif", password: "teacher123", label: "Teacher demo" },
  { role: "admin" as const, username: "nusrat", password: "admin123", label: "Admin demo" },
];

export function findUserByCredentials(username: string, password: string): AppUser | undefined {
  return users.find(
    (u) =>
      u.username.toLowerCase() === username.trim().toLowerCase() &&
      u.password === password
  );
}

export function getUserById(id: string): AppUser | undefined {
  return users.find((u) => u.id === id);
}
