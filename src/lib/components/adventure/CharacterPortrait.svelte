<script lang="ts">
  import {
    characterById,
    emotionLabels,
    emotions,
    type CharacterId,
    type Emotion
  } from '$lib/adventure'
  import { characterIntroductions } from '$lib/character-introductions'
  export let characterId: CharacterId
  export let emotion: Emotion = 'neutral'
  export let variant: 'conversation' | 'introduction' = 'conversation'
  $: index = Math.max(0, emotions.indexOf(emotion))
  $: character = characterById(characterId)
  $: introduction = characterIntroductions[characterId]
  $: artwork =
    variant === 'introduction'
      ? `background-image:url('/images/characters/${character?.gender}-introductions.png');background-size:300% 100%;background-position:${introduction.column * 50}% 0%`
      : `background-image:url('/images/characters/${characterId}-poses.png');background-position:${(index % 3) * 50}% ${Math.floor(index / 3) * 100}%`
  const poses = [
    '腕を自然に下ろしている',
    '手を開いて話している',
    '胸元に手を添えている',
    '顎に手を添えて考えている',
    '手のひらを少し開いている',
    '胸に手を添えてほっとしている'
  ]
</script>

<div
  class="portrait"
  class:trim-start="{variant === 'introduction' && characterId === 'shiori'}"
  role="img"
  aria-label="{variant === 'introduction'
    ? `${character?.name}：${introduction.pose}`
    : `${character?.name}：${emotionLabels[emotion]}。${poses[index]}`}"
  style="{artwork}"
></div>

<style>
  .portrait {
    width: 100%;
    aspect-ratio: 2 / 3;
    background-repeat: no-repeat;
    background-size: 300% 200%;
  }
  /* セル左端に残る隣の袖だけを除き、本人の手や本は切らない。 */
  .trim-start {
    clip-path: inset(0 0 0 3%);
  }
</style>
