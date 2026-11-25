import { EmptyState, SectionHeader } from '../../components/ui';

export default function WritingPage() {
  return (
    <div>
      <SectionHeader title="写作训练" subtitle="30 分钟倒计时、字数统计、范文对照与可选 AI 批改" />
      <EmptyState
        title="写作训练模块待开发"
        description="本目录（src/features/writing/）已预留给 /teamwork 的「写作训练 Agent」独立实现，请按 PRD.md 与 ARCHITECTURE.md 开发。"
      />
    </div>
  );
}
