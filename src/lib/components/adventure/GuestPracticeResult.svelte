<script lang="ts">
  import type { PracticeSession } from '$lib/practice'
  import { guestLoginUrl } from '$lib/guest-practice'
  import { characterById } from '$lib/adventure'
  import CharacterPortrait from './CharacterPortrait.svelte'
  import ListenToCharacter from './ListenToCharacter.svelte'
  import PracticeRewardSummary from './PracticeRewardSummary.svelte'
  import RelationshipMeter from './RelationshipMeter.svelte'
  export let session: PracticeSession
  export let guest: boolean
  export let signedIn: boolean
  export let animateAffinity = false
  const trialHeartPreviewLevel = 6
  $: character = characterById(session.adventure?.characterId)!
  $: evaluation = session.evaluation
  $: trial = session.adventure?.trial
  $: reply = session.turns.at(-1)
</script>

<section class="card guest-result" aria-label="会話の体験結果">
  <div class="portrait">
    <CharacterPortrait
      characterId="{character.id}"
      emotion="{session.turns.at(-1)?.presentation?.emotion ?? 'smile'}"
    />
  </div>
  <div>
    <p class="eyebrow">{character.name}との、はじめの一歩</p>
    <h2>
      {trial
        ? '1往復の会話を体験できました！'
        : evaluation?.status === 'passed'
          ? '第1話の合格点を達成！'
          : evaluation?.status === 'failed'
            ? '次に試したい言葉が、見つかった。'
            : '会話の体験、おつかれさまでした。'}
    </h2>
    {#if trial && reply}
      {#if reply.presentation?.gesture}<p class="small muted">{reply.presentation.gesture}</p>{/if}
      <blockquote>「{reply.assistantText}」</blockquote>
      <ListenToCharacter text="{reply.assistantText}" />
    {/if}
  </div>
  <div class="overview">
    <PracticeRewardSummary
      xp="{session.reward?.xp}"
      caption="{trial && !guest && !session.reward?.xp ? 'この人物の体験XPは獲得済みです。' : ''}"
    >
      <RelationshipMeter
        slot="affinity"
        name="{character.name}"
        value="{trial ? trialHeartPreviewLevel : (evaluation?.affinityAfter ?? 0)}"
        previous="{trial ? 0 : null}"
        animate="{!!trial && animateAffinity}"
        preview="{!!trial || !evaluation}"
      />
    </PracticeRewardSummary>
  </div>
  <div class="result-actions">
    {#if evaluation?.score != null || !trial}
      <p class="score">{evaluation?.score?.toFixed(1) ?? '—'}<span> / 25点</span></p>
    {/if}
    {#if trial}
      <p class="small muted">
        1往復から分かる範囲の評価です。{evaluation?.score == null
          ? '合計点を出せない場合も、振り返りで観点ごとのヒントを確認できます。'
          : ''}
      </p>
    {:else if evaluation?.status === 'pending'}<p>
        採点できない観点があるため、合否は評価待ちです。ログインして保存した後、追加の枠を使わず再評価できます。
      </p>
    {:else}<p>
        クリア目標10点・距離感と配慮2点以上。{evaluation?.status === 'passed'
          ? 'ログイン後も、このクリア判定を引き継げます。'
          : '振り返りをヒントに、ログイン後も練習できます。'}
      </p>{/if}
    {#if guest}
      <a
        class="button primary"
        href="{signedIn ? `/practice/${session.id}?guest=1` : guestLoginUrl(session.id, trial)}"
        >{signedIn ? '体験の記録を保存する' : 'Googleでログインして記録を保存'} →</a
      >
      <p class="small muted">
        {trial
          ? '会話・評価・ヒント・XPを無料で引き継げます。体験XPは人物ごとに1回獲得できます。'
          : '保存時に毎月10枠のうち1枠を使用します。XP・カード・クリア判定も引き継げます。'}
      </p>
    {:else}
      <a class="button primary" href="{`/?character=${character.id}#scenes`}">
        {character.name}との第1話へ →
      </a>
    {/if}
  </div>
</section>

<style>
  .guest-result {
    display: grid;
    grid-template-columns: 130px 1fr;
    gap: 24px;
    padding: 28px;
    margin: 24px 0;
  }
  .portrait {
    overflow: hidden;
    max-height: 240px;
    align-self: center;
  }
  .overview,
  .result-actions {
    grid-column: 1 / -1;
    min-width: 0;
  }
  .portrait :global(.portrait) {
    width: 100%;
  }
  h2 {
    font-size: 1.4rem;
  }
  p {
    line-height: 1.8;
  }
  blockquote {
    margin: 0;
    padding: 12px 16px;
    border-radius: 12px;
    background: var(--surface);
    line-height: 1.7;
  }
  .score {
    font-size: 2rem;
    font-weight: 700;
  }
  .score span {
    font-size: 1rem;
  }
  @media (max-width: 600px) {
    .guest-result {
      grid-template-columns: 1fr;
      padding: 20px;
    }
    .portrait {
      width: 120px;
      max-width: 100%;
      max-height: 150px;
      margin: auto;
    }
  }
</style>
