'use client'

import { useAppStore } from '@/lib/store'
import { RELIGIOSITY_ITEMS, RELIGIOSITY_OPTIONS } from '@/lib/instruments'
import { LikertStage } from '@/components/teenmind/likert-stage'

export function ReligiosityScreen() {
  const religiosity = useAppStore((s) => s.religiosity)
  const patchAnswers = useAppStore((s) => s.patchAnswers)

  return (
    <LikertStage
      stageKey="religiosity"
      stageIcon="🕌"
      stageTitle="Praktik Ibadah"
      nextStage="complete"
      nextStageLabel="Selesaikan"
      items={RELIGIOSITY_ITEMS}
      options={RELIGIOSITY_OPTIONS.map((o) => ({ ...o, color: 'from-teal-100 to-emerald-50 border-teal-300 data-[selected=true]:border-teal-500 data-[selected=true]:bg-teal-100' }))}
      patchFn={(id, v) => patchAnswers('religiosity', id, v)}
      answers={religiosity}
      completeEmoji="🕌"
      completeTitle="Hampir Selesai!"
      completeSubtitle="Bagian ibadah selesai. Kamu hebat sudah sampai sini 🎉"
      buttonGradient="from-teal-500 to-emerald-500"
      autoAdvance={false}
      itemPrefix={(item) => `${item.icon}  ${item.text}`}
      avatarMoods={['happy', 'calm', 'encourage']}
    />
  )
}
