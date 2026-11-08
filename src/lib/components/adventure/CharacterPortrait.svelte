<script lang="ts">
  import {
    characterById,
    emotionLabels,
    emotions,
    type CharacterId,
    type Emotion
  } from '$lib/adventure'
  export let characterId: CharacterId
  export let emotion: Emotion = 'neutral'
  $: index = Math.max(0, emotions.indexOf(emotion))
  $: character = characterById(characterId)
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
  role="img"
  aria-label="{`${character?.name}：${emotionLabels[emotion]}。${poses[index]}`}"
  style="{`background-image:url('/images/characters/${characterId}-poses.png');background-position:${(index % 3) * 50}% ${Math.floor(index / 3) * 100}%`}"
></div>

<style>
  .portrait {
    width: 100%;
    aspect-ratio: 2 / 3;
    background-repeat: no-repeat;
    background-size: 300% 200%;
  }
</style>
