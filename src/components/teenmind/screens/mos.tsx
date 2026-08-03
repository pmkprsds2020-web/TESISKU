'use client'

import { useAppStore } from '@/lib/store'
import { MOS_ITEMS, MOS_OPTIONS } from '@/lib/instruments'
import { LikertStage } from '@/components/teenmind/likert-stage'

export function MosScreen() {
  const mos = useAppStore((s) => s.mos)
  const patchAnswers = useAppStore((s) => s.patchAnswers)

  return (
    <LikertStage
      stageKey="mos"
      stageIcon="🤝"
      stageTitle="Dukungan (MOS-SSS)"
      nextStage="bullying"
      nextStageLabel="Lanjut ke Sekolah"
      items={MOS_ITEMS}
      options={MOS_OPTIONS}
      patchFn={(id, v) => patchAnswers('mos', id, v)}
      answers={mos}
      completeEmoji="🤝"
      completeSubtitle="Bagian dukungan sosial selesai. Lanjut ke bagian sekolah ya 🏫"
      buttonGradient="from-amber-500 to-orange-500"
      autoAdvance={false}
      avatarMoods={['happy', 'calm', 'encourage']}
    />
  )
}
