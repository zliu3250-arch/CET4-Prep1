import { EmptyState, SectionHeader } from '../../components/ui';

export default function TranslationPage() {
  return (
    <div>
      <SectionHeader title="翻译训练" subtitle="四级汉译英段落、难点词汇提示、参考译文与可选 AI 点评" />
      <EmptyState
        title="翻译训练模块待开发"
        description="本目录（src/features/translation/）已预留给 /teamwork 的「翻译训练 Agent」独立实现，请按 PRD.md 与 ARCHITECTURE.md 开发。"
      />
    </div>
  );
}
