import { Check, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { CourseOrmEntity } from './course.orm-entity';

@Entity('course_prerequisites')
@Check('course_prerequisites_not_self', `course_id <> prerequisite_id`)
export class CoursePrerequisiteOrmEntity {
  @PrimaryColumn({ name: 'course_id', type: 'uuid' })
  courseId!: string;

  @PrimaryColumn({ name: 'prerequisite_id', type: 'uuid' })
  prerequisiteId!: string;

  @ManyToOne(() => CourseOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'course_id' })
  course?: CourseOrmEntity;

  @ManyToOne(() => CourseOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'prerequisite_id' })
  prerequisite?: CourseOrmEntity;
}
