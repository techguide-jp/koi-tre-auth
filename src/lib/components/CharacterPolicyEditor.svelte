<script lang="ts">
  import {
    relationshipStages,
    reactionLabels,
    type CharacterContent,
    type CharacterSection
  } from '$lib/character-policy'
  import { knowledgeProfiles, type KnowledgeProfile } from '$lib/knowledge-policy'
  export let content: CharacterContent
  export let section: CharacterSection
  export let pending = false
  export let saving = false
  export let needsInitialSave = false
  export let dirty = false
  export let onsave: () => void
  export let ondiscard: () => void
  export let onchange: () => void
  const groups = {
    profile: [
      ['personality', '性格・人柄', 150, 'どんな人で、どんな一面があるか。'],
      ['interests', '好きなこと・関心', 100, '自然に話題にできるものを設定します。'],
      ['background', '会話に使う背景', 120, '決めておきたい背景がある場合だけ入力します。']
    ],
    values: [
      ['priorities', '大切にしていること', 120, 'この人物が人付き合いで大切にすること。'],
      ['welcomes', '嬉しい・心地よい接し方', 100, '何に喜びや安心を感じるか。'],
      [
        'discomfort',
        '戸惑う・苦手な接し方',
        100,
        '不満をどう感じるか。断ること自体を悪く扱わない設定にします。'
      ]
    ],
    speech: [
      ['tone', '言葉遣い・テンポ', 100, '丁寧さ、言葉の長さ、明るさ、冗談の出し方など。'],
      ['firstPerson', '一人称', 12, '私、僕など。'],
      ['habits', 'その人らしい表現', 80, 'よく見せる表現や、話し方の傾向。']
    ]
  } as const
  const sceneLabels: Record<KnowledgeProfile, string> = {
    first_meeting: '初対面',
    interests: '趣味・休日',
    silence: '静かな時間',
    invitation: '誘い',
    boundary: '断り・境界',
    conflict: 'すれ違い',
    positive_event: '嬉しい出来事',
    feelings: '大切な気持ち',
    general: '日常・その他'
  }
  let stage: keyof CharacterContent['stages'] = 'meeting'
  let scene: KnowledgeProfile = 'first_meeting'
  const reactionFields = Object.entries(reactionLabels).map(([id, label]) => ({
    id: id as keyof typeof reactionLabels,
    label
  }))
  $: fields =
    section === 'profile' || section === 'values' || section === 'speech' ? groups[section] : null
  function value(data: CharacterContent, group: CharacterSection, key: string) {
    return (data[group] as unknown as Record<string, string>)[key]
  }
  function update(key: string, text: string) {
    content = { ...content, [section]: { ...content[section], [key]: text } }
    onchange()
  }
</script>

<form on:submit|preventDefault="{onsave}" aria-label="人物設定の編集" aria-busy="{pending}">
  <fieldset disabled="{pending}">
    {#if fields}
      {#each fields as [key, label, max, hint]}
        <label class="admin-field"
          >{label}<small>{hint}</small>
          <textarea
            rows="{key === 'firstPerson' ? 1 : 3}"
            maxlength="{max}"
            value="{value(content, section, key)}"
            on:input="{(e) => update(key, e.currentTarget.value)}"
            required="{key !== 'background'}"
          ></textarea>
          <small>{value(content, section, key).length} / {max}字</small>
        </label>
      {/each}
    {:else if section === 'stages'}
      <label class="admin-field"
        >編集する関係段階<select bind:value="{stage}"
          >{#each relationshipStages as item}<option value="{item.id}">{item.label}</option
            >{/each}</select
        ></label
      >
      <label class="admin-field"
        >この段階での心の開き方・接し方
        <textarea
          rows="5"
          maxlength="140"
          bind:value="{content.stages[stage]}"
          on:input="{onchange}"
          required
        ></textarea>
        <small
          >その話の段階だけを会話に使います。好感度だけで交際を確定させません。{content.stages[
            stage
          ].length} / 140字</small
        >
      </label>
    {:else if section === 'responses'}
      <label class="admin-field"
        >編集する場面<select bind:value="{scene}"
          >{#each knowledgeProfiles as id}<option value="{id}">{sceneLabels[id]}</option
            >{/each}</select
        ></label
      >
      <label class="admin-field"
        >どう受け止め、どう返すか<textarea
          rows="4"
          maxlength="120"
          bind:value="{content.responses[scene].guidance}"
          on:input="{onchange}"
          required
        ></textarea><small>{content.responses[scene].guidance.length} / 120字</small></label
      >
      <label class="admin-field"
        >参考のセリフ（任意）<textarea
          rows="4"
          maxlength="120"
          bind:value="{content.responses[scene].example}"
          on:input="{onchange}"
        ></textarea><small
          >口調や反応の参考に使います。毎回同じセリフには固定しません。{content.responses[scene]
            .example.length} / 120字</small
        ></label
      >
    {:else}
      <p>会話中の返信とは別に、練習結果で表示する言葉です。</p>
      {#each reactionFields as field}
        <label class="admin-field"
          >{field.label}<textarea
            rows="3"
            maxlength="140"
            bind:value="{content.reactions[field.id]}"
            on:input="{onchange}"
            required
          ></textarea></label
        >
      {/each}
    {/if}
    <div class="actions">
      <button
        class="button primary"
        disabled="{pending || (!dirty && !needsInitialSave)}"
        type="submit"
        >{saving
          ? '保存中…'
          : needsInitialSave
            ? '初期設定を下書きに保存'
            : 'この項目の下書きを保存'}</button
      ><button
        class="button secondary"
        type="button"
        disabled="{pending || !dirty}"
        on:click="{ondiscard}">この項目の変更を戻す</button
      >
    </div>
  </fieldset>
</form>

<style>
  fieldset {
    padding: 0;
    margin: 0;
    border: 0;
    min-width: 0;
  }
  p {
    font-size: 0.85rem;
    line-height: 1.8;
  }
  .admin-field {
    display: block;
    margin: 0 0 22px;
    font-weight: 600;
    line-height: 1.7;
  }
  small {
    display: block;
    font-size: 0.75rem;
    font-weight: 400;
    color: #6b7562;
    margin: 6px 0;
  }
  textarea,
  select {
    display: block;
    width: 100%;
    box-sizing: border-box;
    padding: 12px;
    border: 1px solid #bfc7b5;
    border-radius: 8px;
    background: #fff;
    font: inherit;
    font-weight: 400;
    font-size: 0.9rem;
    color: #303c2a;
    line-height: 1.8;
  }
  textarea {
    resize: vertical;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    border-top: 1px solid #d9ddcf;
    padding-top: 22px;
  }
  .button {
    min-height: 44px;
    padding: 10px 16px;
    border: 1px solid #b5bea8;
    border-radius: 8px;
    font: inherit;
    font-size: 0.8rem;
    cursor: pointer;
  }
  .primary {
    background: #58694d;
    color: white;
  }
  .secondary {
    background: #f7f8f1;
    color: #46533d;
  }
  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
