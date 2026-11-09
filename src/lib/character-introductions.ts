import type { CharacterId } from './adventure-catalog'

// 紹介時は性格を表すポーズ、会話中は感情に応じた既存の表情・仕草を使い分ける。
export const characterIntroductions: Record<CharacterId, { column: number; pose: string }> = {
  aoi: { column: 0, pose: 'カメラを片手に、小さな発見を指さして微笑む' },
  rin: { column: 1, pose: '片手を腰に添え、もう片方の手で楽しそうに語りかける' },
  shiori: { column: 2, pose: '開いた本に手を添え、静かに耳を傾ける' },
  yu: { column: 0, pose: 'コーヒーカップを両手で持ち、少し照れて微笑む' },
  sota: { column: 1, pose: '片手を上げ、明るい笑顔で手を振る' },
  ren: { column: 2, pose: '片腕をゆったり添え、落ち着いた仕草で話しかける' }
}
