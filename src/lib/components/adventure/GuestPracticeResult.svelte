<script lang="ts">
  import type { PracticeSession } from '$lib/practice'
  import { guestLoginUrl } from '$lib/guest-practice'
  import { characterById } from '$lib/adventure'
  import CharacterPortrait from './CharacterPortrait.svelte'
  export let session: PracticeSession
  $: character = characterById(session.adventure?.characterId)!
  $: evaluation = session.evaluation
</script>

<section class="card guest-result" aria-label="第1話の体験結果">
  <div class="portrait">
    <CharacterPortrait
      characterId="{character.id}"
      emotion="{session.turns.at(-1)?.presentation?.emotion ?? 'smile'}"
    />
  </div>
  <div>
    <p class="eyebrow">{character.name}との、はじめの一歩</p>
    <h2>
      {evaluation?.status === 'passed'
        ? '第1話の合格点を達成！'
        : evaluation?.status === 'failed'
          ? '次に試したい言葉が、見つかった。'
          : '会話の体験、おつかれさまでした。'}
    </h2>
    <p class="score">{evaluation?.score?.toFixed(1) ?? '—'}<span> / 25点</span></p>
    {#if evaluation?.status === 'pending'}<p>
        採点できない観点があるため、合否は評価待ちです。ログインして保存した後、追加の枠を使わず再評価できます。
      </p>
    {:else}<p>
        クリア目標10点・距離感と配慮2点以上。{evaluation?.status === 'passed'
          ? 'ログイン後も、このクリア判定を引き継げます。'
          : '振り返りをヒントに、ログイン後も練習できます。'}
      </p>{/if}
    <a class="button primary" href="{guestLoginUrl(session.id)}"
      >Googleでログインして、会話を保存する →</a
    >
    <p class="small muted">
      保存時に毎月10枠のうち1枠を使用します。XP・カード・クリア判定も引き継ぎ、同じ体験で二重に消費しません。
    </p>
    <p class="small muted">
      体験はこのブラウザで30日間再開できます。Cookieを削除する前にログインして保存してください。
    </p>
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
    align-self: end;
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
