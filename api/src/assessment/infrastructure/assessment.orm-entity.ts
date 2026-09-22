import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { UserOrmEntity } from '../../identity/infrastructure/user.orm-entity';

@Entity('assessment_sessions')
@Check(
  'assessment_sessions_status_check',
  `status IN ('in_progress', 'completed', 'abandoned')`,
)
// Máximo una entrevista en curso por usuario, garantizado también por la BD.
@Index('uq_assessment_sessions_in_progress', ['userId'], {
  unique: true,
  where: `status = 'in_progress'`,
})
@Index('ix_assessment_sessions_user', ['userId'])
export class AssessmentSessionOrmEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: UserOrmEntity;

  @Column({ type: 'varchar', length: 20 })
  status!: string;

  @Column({ name: 'goal_text', type: 'text', nullable: true })
  goalText!: string | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

@Entity('assessment_answers')
@Unique('uq_assessment_answers_question', ['sessionId', 'questionKey'])
export class AssessmentAnswerOrmEntity {
  @PrimaryColumn({ name: 'session_id', type: 'uuid' })
  sessionId!: string;

  @PrimaryColumn({ type: 'smallint' })
  position!: number;

  @ManyToOne(() => AssessmentSessionOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session?: AssessmentSessionOrmEntity;

  @Column({ name: 'question_key', type: 'varchar', length: 64 })
  questionKey!: string;

  @Column({ type: 'jsonb' })
  answer!: unknown;

  @Column({ type: 'smallint', nullable: true })
  score!: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity('skill_profiles')
@Check(
  'skill_profiles_interpreted_by_check',
  `interpreted_by IN ('claude', 'rules')`,
)
export class SkillProfileOrmEntity {
  @PrimaryColumn({ name: 'session_id', type: 'uuid' })
  sessionId!: string;

  @OneToOne(() => AssessmentSessionOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session?: AssessmentSessionOrmEntity;

  @Column({ type: 'jsonb' })
  levels!: Record<string, number>;

  @Column({ name: 'target_skills', type: 'text', array: true })
  targetSkills!: string[];

  @Column({ name: 'interpreted_by', type: 'varchar', length: 10 })
  interpretedBy!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
