import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { Catalog, CourseLevel, SkillArea } from '../../domain/catalog';
import type { CatalogRepository } from '../../domain/catalog.repository';

@Injectable()
export class TypeOrmCatalogRepository implements CatalogRepository {
  constructor(private readonly dataSource: DataSource) {}

  async load(): Promise<Catalog> {
    const [skills, courses, courseSkills, prerequisites] = await Promise.all([
      this.dataSource.query<{ slug: string; name: string; area: SkillArea }[]>(
        `SELECT slug, name, area FROM skills ORDER BY slug`,
      ),
      this.dataSource.query<
        {
          slug: string;
          title: string;
          url: string;
          image_url: string;
          summary: string;
          level: CourseLevel;
          duration_hours: string;
        }[]
      >(
        `SELECT slug, title, url, image_url, summary, level, duration_hours FROM courses ORDER BY slug`,
      ),
      this.dataSource.query<
        { course: string; skill: string; relation: 'teaches' | 'requires' }[]
      >(
        `SELECT c.slug AS course, s.slug AS skill, cs.relation
         FROM course_skills cs JOIN courses c ON c.id = cs.course_id JOIN skills s ON s.id = cs.skill_id
         ORDER BY s.slug`,
      ),
      this.dataSource.query<{ course: string; prerequisite: string }[]>(
        `SELECT c.slug AS course, p.slug AS prerequisite
         FROM course_prerequisites cp
         JOIN courses c ON c.id = cp.course_id JOIN courses p ON p.id = cp.prerequisite_id
         ORDER BY p.slug`,
      ),
    ]);

    const relations = (course: string, relation: 'teaches' | 'requires') =>
      courseSkills
        .filter((r) => r.course === course && r.relation === relation)
        .map((r) => r.skill);

    return {
      skills,
      courses: courses.map((c) => ({
        slug: c.slug,
        title: c.title,
        url: c.url,
        imageUrl: c.image_url,
        summary: c.summary,
        level: c.level,
        durationHours: Number(c.duration_hours),
        teaches: relations(c.slug, 'teaches'),
        requires: relations(c.slug, 'requires'),
        prerequisites: prerequisites
          .filter((p) => p.course === c.slug)
          .map((p) => p.prerequisite),
      })),
    };
  }
}
