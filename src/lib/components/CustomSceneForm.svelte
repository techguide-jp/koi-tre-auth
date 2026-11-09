<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte'
  import {
    MAX_SITUATION_LENGTH,
    MAX_PARTNER_NAME_LENGTH,
    MAX_OPENING_LINE_LENGTH,
    normalizeCustomScene,
    type CustomSceneInput
  } from '$lib/practice'
  import { readCustomSceneDraft, saveCustomSceneDraft } from '$lib/custom-scene-client'
  export let disabled = false
  export let pending = false
  let situation = ''
  let partnerName = ''
  let openingLine = ''
  let message = ''
  let expanded = false
  const dispatch = createEventDispatcher<{ start: CustomSceneInput }>()
  onMount(() => {
    const draft = readCustomSceneDraft()
    situation = draft.situation
    partnerName = draft.partnerName
    openingLine = draft.openingLine
    expanded = !!draft.situation
  })
  function saveDraft() {
    saveCustomSceneDraft({ situation, partnerName, openingLine })
  }
  function submit() {
    const scene = normalizeCustomScene({ situation, partnerName, openingLine })
    if (!scene) {
      message = '状況と呼び名の入力内容を確認してください。'
      return
    }
    message = ''
    saveDraft()
    dispatch('start', scene)
  }
</script>

<details class="custom-scene" id="custom-scene" open="{expanded}">
  <summary
    ><span
      ><span class="custom-label">自分に合った練習を</span><strong
        >練習したい場面を、自分で決める</strong
      ><span class="custom-description"
        >「2回目のデートで、次の約束をしたい」など、具体的な状況から。</span
      ></span
    ><span class="expand" aria-hidden="true">＋</span></summary
  >
  <form on:submit|preventDefault="{submit}">
    <label for="custom-situation"
      >どんな場面を練習したいですか？<span class="required">必須</span></label
    >
    <textarea
      id="custom-situation"
      bind:value="{situation}"
      on:input="{saveDraft}"
      maxlength="{MAX_SITUATION_LENGTH}"
      rows="4"
      placeholder="例：2回目のデートの帰り道。楽しかったことを伝えて、来週また会う約束をしたい。相手は少し人見知り。"
      required
      disabled="{pending}"
    ></textarea>
    <p class="field-note">
      場所、相手との関係、話したいことを書くと練習しやすくなります。相手を「成人の男性」「成人の女性」と指定することもできます。ご自身の性別は入力不要です。<span
        >{situation.length} / {MAX_SITUATION_LENGTH}</span
      >
    </p>
    <div class="optional-fields">
      <div>
        <label for="custom-partner">相手の呼び名<span>任意・敬称なし</span></label><input
          id="custom-partner"
          bind:value="{partnerName}"
          on:input="{saveDraft}"
          maxlength="{MAX_PARTNER_NAME_LENGTH}"
          placeholder="はる"
          disabled="{pending}"
        />
        <p class="field-note">未入力なら「はるさん」がお相手です。</p>
      </div>
      <div>
        <label for="custom-opening">相手の最初のひと言<span>任意</span></label><textarea
          id="custom-opening"
          bind:value="{openingLine}"
          on:input="{saveDraft}"
          maxlength="{MAX_OPENING_LINE_LENGTH}"
          rows="2"
          placeholder="例：今日は楽しかったですね。"
          disabled="{pending}"
        ></textarea>
        <p class="field-note">未入力なら、あなたから話し始めます。</p>
      </div>
    </div>
    {#if message}<p class="error" role="alert">{message}</p>{/if}
    <div class="custom-actions">
      <p>
        いつもの練習と同じ、3回返答して振り返りへ。<br
        />月10回の練習枠を使います。実名・連絡先は入力しないでください。
      </p>
      <button
        class="button primary"
        disabled="{disabled || !situation.trim()}"
        aria-busy="{pending}"
        >{pending ? '準備しています…' : 'この設定で練習する'}<span aria-hidden="true">→</span
        ></button
      >
    </div>
  </form>
</details>

<style>
  .custom-scene {
    margin-top: 1.5rem;
    border: 1px solid #c8cbbb;
    background: #fffefa;
    scroll-margin-top: 1rem;
  }
  summary {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: center;
    padding: 1.5rem;
    cursor: pointer;
    list-style: none;
  }
  summary::-webkit-details-marker {
    display: none;
  }
  .custom-label,
  .custom-description {
    display: block;
    font-size: var(--text-sm);
    color: var(--muted);
    line-height: 1.9;
  }
  .custom-label {
    color: var(--accent);
    font-size: var(--text-xs);
    margin-bottom: 0.35rem;
  }
  strong {
    display: block;
    font-weight: 600;
    font-size: 1rem;
    margin-bottom: 0.35rem;
  }
  .expand {
    color: var(--accent);
    font-size: 1.5rem;
  }
  details[open] .expand {
    transform: rotate(45deg);
  }
  form {
    padding: 0 1.5rem 1.5rem;
  }
  label {
    display: block;
    font-size: var(--text-sm);
    font-weight: 600;
    margin: 0.9rem 0 0.6rem;
  }
  label > span {
    font-size: var(--text-xs);
    font-weight: 400;
    color: var(--muted);
    margin-left: 0.7rem;
  }
  label .required {
    color: var(--accent);
  }
  input,
  textarea {
    width: 100%;
    padding: 0.8rem;
    background: #fcfbf8;
    border: 1px solid #c8cbbb;
    border-radius: 4px;
    font: inherit;
    font-size: 1rem;
    line-height: 1.8;
  }
  textarea {
    resize: vertical;
    display: block;
  }
  .field-note {
    font-size: var(--text-xs);
    line-height: 1.8;
    color: var(--muted);
    margin: 0.5rem 0 0;
  }
  .field-note span {
    display: block;
    text-align: right;
  }
  .optional-fields {
    display: grid;
    grid-template-columns: 1fr 1.5fr;
    gap: 1.5rem;
  }
  .custom-actions {
    border-top: 1px solid var(--border);
    padding-top: 1.25rem;
    margin-top: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }
  .custom-actions p {
    font-size: var(--text-xs);
    margin: 0;
    color: var(--muted);
  }
  .custom-actions .button {
    font-size: var(--text-sm);
    flex-shrink: 0;
  }
  @media (max-width: 700px) {
    summary {
      padding: 1.2rem;
    }
    strong {
      font-size: var(--text-base);
    }
    form {
      padding: 0 1.2rem 1.2rem;
    }
    .optional-fields {
      grid-template-columns: 1fr;
      gap: 0;
    }
    .custom-actions {
      flex-direction: column;
      align-items: stretch;
    }
  }
</style>
