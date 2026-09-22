import { Check, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { CourseOrmEntity } from './course.orm-entity';
import { SkillOrmEntity } from './skill.orm-entity';

@Entity('course_skills')
@Check('course_skills_relation_check', `relation IN ('teaches', 'requires')`)
export class CourseSkillOrmEntity {
  @PrimaryColumn({ name: 'course_id', type: 'uuid' })
  courseId!: string;

  @PrimaryColumn({ name: 'skill_id', type: 'uuid' })
  skillId!: string;

  @PrimaryColumn({ type: 'varchar', length: 10 })
  relation!: 'teaches' | 'requires';

  @ManyToOne(() => CourseOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'course_id' })
  course?: CourseOrmEntity;

  @ManyToOne(() => SkillOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'skill_id' })
  skill?: SkillOrmEntity;
}
