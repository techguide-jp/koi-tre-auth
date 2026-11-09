<script lang="ts">
  import { onMount } from 'svelte'
  import { authReady, authenticatedFetch, user } from '$lib/stores'
  import {
    knowledgeProfiles,
    type KnowledgeContent,
    type KnowledgeOverview,
    type KnowledgeProfile
  } from '$lib/knowledge-policy'
  import type { KnowledgePreviewResult } from '$lib/server/knowledge-service'
  import PracticeAnalysis from '$lib/components/PracticeAnalysis.svelte'
  type View = KnowledgeOverview & { cases: { id: string; title: string; check: string }[] }
  const labels: Record<KnowledgeProfile, string> = {
    first_meeting: '初対面',
    interests: '趣味・休日',
    silence: '静かな時間',
    invitation: '誘い',
    boundary: '断り・境界',
    conflict: 'すれ違い',
    positive_event: '嬉しい出来事',
    feelings: '大切な気持ち',
    general: 'その他'
  }
  let view: View | null = null
  let content: KnowledgeContent = { core: '', documents: [] }
  let saved = ''
  let pending: 'load' | 'save' | 'preview' | 'publish' | 'activate' | null = null
  let result: KnowledgePreviewResult | null = null
  let message = '',
    success = '',
    caseId = '',
    note = '',
    reverting = ''
  let reviewed = false,
    mounted = false,
    loadedUid = ''
  $: dirty = JSON.stringify(content) !== saved
  $: checked =
    !!view &&
    (result?.passed ||
      (view.preview?.passed &&
        view.preview.revision === view.revision &&
        view.preview.checkedBy === $user?.uid))
  $: if (mounted && $authReady && $user && loadedUid !== $user.uid) {
    loadedUid = $user.uid
    void load()
  }
  $: if (!$user) {
    view = null
    result = null
    content = { core: '', documents: [] }
    saved = ''
    loadedUid = ''
  }
  onMount(() => {
    mounted = true
    return () => {
      mounted = false
    }
  })
  function apply(next: View) {
    view = next
    content = structuredClone(next.draft)
    saved = JSON.stringify(content)
    result = null
    reviewed = false
    if (!caseId) caseId = next.cases[0]?.id ?? ''
  }
  async function load() {
    if (pending) return
    pending = 'load'
    message = ''
    success = ''
    const uid = $user?.uid
    try {
      const response = await authenticatedFetch('/api/admin/knowledge')
      const next = await response.json()
      if (mounted && $user?.uid === uid) apply(next)
    } catch (cause) {
      if (mounted)
        message = cause instanceof Error ? cause.message : '管理画面を読み込めませんでした。'
    } finally {
      if (mounted) pending = null
    }
  }
  function reload() {
    if (dirty && !confirm('未保存の変更を破棄して、最新版を読み込みますか？')) return
    void load()
  }
  function changed() {
    reviewed = false
    result = null
    success = ''
  }
  function addDocument() {
    content = {
      ...content,
      documents: [
        ...content.documents,
        { id: crypto.randomUUID(), title: '', content: '', profiles: [] }
      ]
    }
    changed()
  }
  function removeDocument(id: string) {
    content = { ...content, documents: content.documents.filter((doc) => doc.id !== id) }
    changed()
  }
  function toggleProfile(id: string, profile: KnowledgeProfile, selected: boolean) {
    content = {
      ...content,
      documents: content.documents.map((doc) =>
        doc.id === id
          ? {
              ...doc,
              profiles: selected
                ? [...doc.profiles, profile]
                : doc.profiles.filter((p) => p !== profile)
            }
          : doc
      )
    }
    changed()
  }
  async function mutate(action: 'save' | 'publish' | 'activate', id?: string) {
    if (pending || !view || (action === 'activate' && dirty)) return
    pending = action
    message = ''
    success = ''
    reverting = id ?? ''
    const uid = $user?.uid
    const payload =
      action === 'save'
        ? { revision: view.revision, content }
        : action === 'publish'
          ? { action, revision: view.revision, reviewed, note }
          : { action, id, expected: view.active?.id ?? null }
    try {
      const response = await authenticatedFetch('/api/admin/knowledge', {
        method: action === 'save' ? 'PUT' : 'POST',
        body: JSON.stringify(payload)
      })
      const next = await response.json()
      if (mounted && $user?.uid === uid) {
        apply(next)
        success =
          action === 'save'
            ? '下書きを保存しました。公開版にはまだ反映されていません。'
            : action === 'publish'
              ? '公開しました。これから始まる練習に適用します。'
              : '公開版を切り替えました。開始済みの練習は元の版を使います。'
        note = ''
      }
    } catch (cause) {
      if (mounted) message = cause instanceof Error ? cause.message : '保存できませんでした。'
    } finally {
      if (mounted) {
        pending = null
        reverting = ''
      }
    }
  }
  async function preview() {
    if (pending || !view || dirty || !caseId) return
    pending = 'preview'
    message = ''
    success = ''
    result = null
    reviewed = false
    view = { ...view, preview: null }
    const uid = $user?.uid
    try {
      const response = await authenticatedFetch('/api/admin/knowledge', {
        method: 'POST',
        body: JSON.stringify({ action: 'preview', revision: view.revision, caseId })
      })
      const next: KnowledgePreviewResult = await response.json()
      if (mounted && $user?.uid === uid) {
        result = next
        success = next.passed
          ? '方針の適用と評価を確認できました。内容を読んで公開を判断してください。'
          : '会話は生成されましたが、評価か場面の確認が揃っていません。再確認してください。'
      }
    } catch (cause) {
      if (mounted) message = cause instanceof Error ? cause.message : '動作確認に失敗しました。'
    } finally {
      if (mounted) pending = null
    }
  }
  const date = (value: string) =>
    new Date(value).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
</script>

<svelte:head
  ><title>評価方針と知識の管理 | Koi-Tre</title><meta
    name="robots"
    content="noindex,nofollow"
  /></svelte:head
>
<main class="knowledge-admin">
  <a class="back" href="/account">← マイページ</a>
  <p class="eyebrow">Koi-Tre 運営管理</p>
  <h1>評価方針と知識</h1>
  <p class="intro">
    大切にする考え方を整え、場面に合う知識を増やす。下書きで確かめてから、新しい練習に公開します。
  </p>
  {#if !$authReady}<p role="status">ログイン状態を確認しています…</p>
  {:else if !$user}<section class="panel">
      <h2>管理者のログインが必要です</h2>
      <p>指定されたGoogleアカウントでログインしてください。</p>
      <a href="/login" class="button primary">ログインへ</a>
    </section>
  {:else}
    {#if message}<p class="error" role="alert">{message}</p>{/if}
    {#if success}<p class="notice" role="status">{success}</p>{/if}
    <div class="toolbar">
      <span>{$user.email}</span><button
        class="button secondary"
        disabled="{!!pending}"
        aria-busy="{pending === 'load'}"
        on:click="{reload}">{pending === 'load' ? '読み込み中…' : '最新版を読み込む'}</button
      >
    </div>
    {#if view}
      <section class="published">
        <div>
          <p class="eyebrow">現在の公開版</p>
          <h2>{view.active ? `v${view.active.version}` : '既存の方針で動作中'}</h2>
          <p>
            {view.active
              ? `${date(view.active.createdAt)} · ${view.active.note || '公開メモなし'}`
              : 'まだ公開版はありません。下書きの確認後に公開できます。'}
          </p>
        </div>
        <div class="status">
          下書き #{view.revision}<strong
            >{dirty ? '未保存の変更あり' : view.revision ? '保存済み' : '初期案（未保存）'}</strong
          >
        </div>
      </section>
      <section class="panel">
        <div class="section-heading">
          <div>
            <p class="eyebrow">1. 毎回適用する</p>
            <h2>基本の価値観・方針</h2>
          </div>
          <span class="count">{content.core.length} / 3,000字</span>
        </div>
        <p class="hint">
          会話と評価の両方に必ず渡します。本人の事実や意思、引用・出力形式などの検証はシステム側でも維持します。
        </p>
        <label class="field"
          >基本方針<textarea
            rows="10"
            maxlength="3000"
            bind:value="{content.core}"
            disabled="{!!pending}"
            on:input="{changed}"
          ></textarea></label
        >
      </section>
      <section class="panel">
        <div class="section-heading">
          <div>
            <p class="eyebrow">2. 場面に合わせて参照する</p>
            <h2>知識文書</h2>
          </div>
          <span class="count">{content.documents.length} / 40件</span>
        </div>
        <p class="hint">
          場面別のノウハウ、よい例・避けたい例、研究メモなど。場面と本文から関連箇所を選び、生成と評価に渡します。
        </p>
        {#each content.documents as doc, index (doc.id)}
          <details class="document">
            <summary
              >{index + 1}. {doc.title || '新しい文書'}<span
                >{doc.profiles.map((p) => labels[p]).join('・') || 'すべての場面'}</span
              ></summary
            >
            <div class="document-body">
              <label class="field"
                >タイトル<input
                  maxlength="80"
                  bind:value="{doc.title}"
                  disabled="{!!pending}"
                  on:input="{changed}"
                /></label
              >
              <fieldset disabled="{!!pending}">
                <legend>参照する場面（未選択なら全場面）</legend>
                <div class="tags">
                  {#each knowledgeProfiles as profile}<label
                      ><input
                        type="checkbox"
                        checked="{doc.profiles.includes(profile)}"
                        on:change="{(event) =>
                          toggleProfile(doc.id, profile, event.currentTarget.checked)}"
                      />{labels[profile]}</label
                    >{/each}
                </div>
              </fieldset>
              <label class="field"
                >本文<textarea
                  rows="7"
                  maxlength="12000"
                  bind:value="{doc.content}"
                  disabled="{!!pending}"
                  on:input="{changed}"
                ></textarea></label
              >
              <button
                class="remove"
                disabled="{!!pending}"
                on:click="{() => removeDocument(doc.id)}">この文書を下書きから外す</button
              >
            </div>
          </details>
        {/each}
        <button
          class="button secondary"
          disabled="{!!pending || content.documents.length >= 40}"
          on:click="{addDocument}">＋ 文書を追加</button
        >
        <div class="save-row">
          <span
            >{dirty || !view.revision
              ? '確認・公開の前に保存してください。'
              : '下書きの変更は、公開するまで練習に反映されません。'}</span
          ><button
            class="button primary"
            disabled="{!!pending || (!dirty && !!view.revision)}"
            aria-busy="{pending === 'save'}"
            on:click="{() => mutate('save')}"
            >{pending === 'save' ? '下書きを保存中…' : '下書きを保存する'}</button
          >
        </div>
      </section>
      <section class="panel">
        <p class="eyebrow">3. サンプル会話で確かめる</p>
        <h2>動作確認</h2>
        <p class="hint">通常の練習枠・XP・好感度には反映しません。AIの呼び出しは発生します。</p>
        <label class="field"
          >確認する場面<select bind:value="{caseId}" disabled="{!!pending}"
            >{#each view.cases as sample}<option value="{sample.id}">{sample.title}</option
              >{/each}</select
          ></label
        >
        <p class="hint">{view.cases.find((sample) => sample.id === caseId)?.check}</p>
        <button
          class="button secondary"
          disabled="{!!pending || dirty || !view.revision}"
          aria-busy="{pending === 'preview'}"
          on:click="{preview}"
          >{pending === 'preview'
            ? '会話と評価を確認中…'
            : '保存した下書きでAIの動作を確認'}</button
        >
        {#if result}<div class="preview">
            <h3>{result.passed ? '方針の適用・評価を確認' : '確認が必要です'}</h3>
            <p class="reply">「{result.reply}」</p>
            <h3>参照した知識</h3>
            {#if !result.context.passages.length}<p>
                関連箇所なし。基本方針を使いました。
              </p>{/if}{#each result.context.passages as passage}<details>
                <summary>{passage.title}</summary>
                <p class="passage">{passage.content}</p>
              </details>{/each}
            {#if result.feedback?.analysis}<p>{result.feedback.analysis.summary}</p>
              <PracticeAnalysis analysis="{result.feedback.analysis}" />{/if}
          </div>{/if}
      </section>
      <section class="panel publish">
        <p class="eyebrow">4. 新しい練習へ公開する</p>
        <h2>公開</h2>
        <p>
          公開後に始まる練習から適用します。途中の会話、過去の評価・クリア・好感度は、その会話の方針を保ちます。
        </p>
        <label class="field"
          >公開メモ<input
            maxlength="200"
            placeholder="変更した考え方や理由"
            bind:value="{note}"
            disabled="{!!pending}"
          /></label
        >
        <label class="reviewed"
          ><input
            type="checkbox"
            bind:checked="{reviewed}"
            disabled="{!!pending || dirty || !checked}"
          />動作確認の内容を読み、この方針で公開する</label
        >
        <button
          class="button primary"
          disabled="{!!pending || dirty || !checked || !reviewed}"
          aria-busy="{pending === 'publish'}"
          on:click="{() => mutate('publish')}"
          >{pending === 'publish' ? '公開しています…' : 'この方針を公開する'}</button
        >
      </section>
      <section class="panel">
        <h2>公開履歴・旧版への復帰</h2>
        <p class="hint">直近30版を表示します。以前の版へ戻す操作も、新しい練習から適用します。</p>
        {#if dirty}<p class="hint">
            未保存の変更があります。版を切り替える前に下書きを保存してください。
          </p>{/if}
        {#if !view.releases.length}<p>公開履歴はまだありません。</p>{/if}
        {#each view.releases as release}<div class="history">
            <div>
              <strong>v{release.version}{view.active?.id === release.id ? ' · 公開中' : ''}</strong>
              <p>{date(release.createdAt)}</p>
              <p>{release.note || '公開メモなし'}</p>
            </div>
            <button
              class="button secondary"
              disabled="{!!pending || dirty || view.active?.id === release.id}"
              aria-busy="{pending === 'activate' && reverting === release.id}"
              on:click="{() => mutate('activate', release.id)}"
              >{pending === 'activate' && reverting === release.id
                ? '切り替え中…'
                : `v${release.version}へ戻す`}</button
            >
          </div>{/each}
      </section>
    {/if}
  {/if}
</main>

<style>
  .knowledge-admin {
    max-width: 1000px;
    margin: 0 auto;
    padding: 36px 24px 80px;
    color: var(--ink, #30382f);
  }
  h1 {
    margin: 8px 0 16px;
    font-size: clamp(1.8rem, 4vw, 2.8rem);
  }
  h2 {
    margin: 4px 0 12px;
    font-size: 1.3rem;
  }
  h3 {
    margin-top: 24px;
    font-size: 1rem;
  }
  .intro,
  .panel p {
    line-height: 1.9;
  }
  .back {
    font-size: 0.8rem;
  }
  .eyebrow {
    margin: 12px 0 5px;
    color: #9a6756;
    font-size: 0.72rem;
    letter-spacing: 0.08em;
  }
  .panel {
    margin-top: 24px;
    padding: 28px;
    border: 1px solid #d7d8ce;
    border-radius: 14px;
    background: #fffcf6;
    min-width: 0;
  }
  .published {
    display: flex;
    justify-content: space-between;
    gap: 20px;
    margin-top: 22px;
    padding: 24px 28px;
    background: #e9ede3;
    border-radius: 14px;
  }
  .published p {
    margin: 4px 0;
    font-size: 0.8rem;
  }
  .status {
    font-size: 0.75rem;
    min-width: 120px;
  }
  .status strong {
    display: block;
    margin-top: 8px;
  }
  .toolbar,
  .section-heading,
  .save-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }
  .toolbar {
    margin-top: 26px;
    font-size: 0.75rem;
    overflow-wrap: anywhere;
  }
  .count,
  .hint,
  .save-row span {
    color: #6d7568;
    font-size: 0.75rem;
  }
  .section-heading .eyebrow {
    margin-top: 0;
  }
  .field {
    display: grid;
    gap: 8px;
    margin: 18px 0;
    font-size: 0.8rem;
    font-weight: 600;
  }
  textarea,
  input:not([type='checkbox']),
  select {
    width: 100%;
    box-sizing: border-box;
    padding: 12px;
    border: 1px solid #c8ccbf;
    border-radius: 7px;
    background: #fffefa;
    color: #30382f;
    font: inherit;
    font-weight: 400;
    line-height: 1.8;
    min-width: 0;
  }
  textarea {
    resize: vertical;
  }
  select {
    white-space: normal;
  }
  fieldset {
    margin: 18px 0;
    border: 1px solid #dce0d3;
    border-radius: 8px;
    padding: 12px;
  }
  legend {
    font-size: 0.75rem;
  }
  .tags {
    display: flex;
    gap: 10px 16px;
    flex-wrap: wrap;
  }
  .tags label,
  .reviewed {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 0.75rem;
  }
  input[type='checkbox'] {
    accent-color: #66745c;
  }
  .document {
    border: 1px solid #d9ddcf;
    border-radius: 8px;
    margin: 12px 0;
  }
  summary {
    padding: 15px;
    cursor: pointer;
    font-size: 0.85rem;
    overflow-wrap: anywhere;
  }
  summary span {
    display: block;
    padding: 4px 0 0 16px;
    font-size: 0.68rem;
    color: #7a816f;
  }
  .document-body {
    padding: 0 18px 18px;
  }
  .remove {
    padding: 8px 0;
    border: 0;
    background: transparent;
    color: #9a5349;
    text-decoration: underline;
    font-size: 0.75rem;
    cursor: pointer;
  }
  .save-row {
    border-top: 1px solid #dce0d3;
    margin-top: 24px;
    padding-top: 22px;
  }
  .button {
    min-height: 42px;
    display: inline-flex;
    justify-content: center;
    align-items: center;
    padding: 10px 18px;
    border-radius: 7px;
    border: 1px solid #b5bea8;
    font: inherit;
    font-size: 0.8rem;
    cursor: pointer;
    text-decoration: none;
    box-sizing: border-box;
  }
  .primary {
    background: #58694d;
    color: white;
    border-color: #58694d;
  }
  .secondary {
    background: #f7f8f1;
    color: #46533d;
  }
  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .notice,
  .error {
    border-radius: 8px;
    padding: 16px;
    line-height: 1.8;
  }
  .notice {
    background: #edf1e5;
    color: #44553a;
  }
  .error {
    background: #f7eae5;
    color: #943f31;
  }
  .reviewed {
    margin: 22px 0;
    line-height: 1.8;
  }
  .preview {
    margin-top: 24px;
    border-top: 1px solid #dce0d3;
    padding-top: 4px;
    overflow-wrap: anywhere;
  }
  .reply {
    background: #f1eee4;
    padding: 16px;
    border-radius: 10px;
  }
  .passage {
    white-space: pre-wrap;
    font-size: 0.8rem;
  }
  .history {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 18px;
    padding: 20px 0;
    border-top: 1px solid #e0e1d8;
  }
  .history p {
    margin: 4px 0;
    font-size: 0.75rem;
    overflow-wrap: anywhere;
  }
  .history .button {
    flex-shrink: 0;
  }
  @media (max-width: 600px) {
    .knowledge-admin {
      padding: 26px 16px 60px;
    }
    .panel {
      padding: 20px 16px;
    }
    .published {
      padding: 20px 16px;
      flex-direction: column;
      gap: 12px;
    }
    .status {
      display: flex;
      gap: 15px;
      align-items: center;
    }
    .status strong {
      margin: 0;
    }
    .history {
      align-items: flex-start;
      flex-direction: column;
    }
    .save-row .button {
      width: 100%;
    }
  }
</style>
