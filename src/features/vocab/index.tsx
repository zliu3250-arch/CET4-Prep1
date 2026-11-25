import { EmptyState, SectionHeader } from '../../components/ui';

export default function VocabPage() {
  return (
    <div>
      <SectionHeader title="单词拼写" subtitle="听音/看释义拼写、字母提示与错词本重练" />
      <EmptyState
        title="单词拼写模块待开发"
        description="本目录（src/features/vocab/）已预留给 /teamwork 的「单词拼写 Agent」独立实现，请按 PRD.md 与 ARCHITECTURE.md 开发。"
      />
    </div>
  );
}
