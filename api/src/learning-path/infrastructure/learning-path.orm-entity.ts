import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { AssessmentSessionOrmEntity } from '../../assessment/infrastructure/assessment.orm-entity';
import { CourseOrmEntity } from '../../catalog/infrastructure/persistence/course.orm-entity';
import { UserOrmEntity } from '../../identity/infrastructure/user.orm-entity';

@Entity('learning_paths')
@Check('learning_paths_status_check', `status IN ('active', 'archived')`)
@Check(
  'learning_paths_generated_by_check',
  `generated_by IN ('rules', 'claude')`,
)
@Index('ix_learning_paths_user_status', ['userId', 'status'])
export class LearningPathOrmEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: UserOrmEntity;

  @Column({ name: 'session_id', type: 'uuid', nullable: true })
  sessionId!: string | null;

  @ManyToOne(() => AssessmentSessionOrmEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'session_id' })
  session?: AssessmentSessionOrmEntity;

  @Column({ type: 'varchar', length: 80 })
  name!: string;

  @Column({ type: 'text' })
  goal!: string;

  @Column({ type: 'varchar', length: 10 })
  status!: string;

  @Column({ name: 'generated_by', type: 'varchar', length: 10 })
  generatedBy!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

@Entity('path_steps')
@Unique('uq_path_steps_course', ['pathId', 'courseId'])
@Unique('uq_path_steps_position', ['pathId', 'position'])
export class PathStepOrmEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'path_id', type: 'uuid' })
  pathId!: string;

  @ManyToOne(() => LearningPathOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'path_id' })
  path?: LearningPathOrmEntity;

  // RESTRICT: si el seed intenta borrar un curso que está en una ruta, falla a propósito.
  @Column({ name: 'course_id', type: 'uuid' })
  courseId!: string;

  @ManyToOne(() => CourseOrmEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'course_id' })
  course?: CourseOrmEntity;

  @Column({ type: 'smallint' })
  position!: number;

  @Column({ type: 'text' })
  rationale!: string;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;
}
