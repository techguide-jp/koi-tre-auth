<script lang="ts">
  const steps = [
    {
      number: '01',
      title: 'お相手と場面を選ぶ',
      text: '男性・女性からお相手を選んで、気になる物語へ。第1話はログインせず試せます。'
    },
    {
      number: '02',
      title: 'あなたの言葉で話す',
      text: '表情や仕草を見ながら、3往復か6往復。うまく話そうとしすぎなくて大丈夫。'
    },
    {
      number: '03',
      title: '次に使うひと言を見つける',
      text: 'よかった点と言い換え例をチェック。実際の会話で試したい言葉を持ち帰りましょう。'
    }
  ]
  const aspects = [
    '受け止め・共感',
    '自分の伝え方',
    'キャッチボール',
    '話題のつながり',
    '距離感・配慮'
  ]
</script>

<div class="guide">
  <header class="intro">
    <p class="eyebrow">はじめてのKoi-Tre</p>
    <h1>会う日の前に、<br />ちょっと話してみよう。</h1>
    <p>初対面も、デートも、本音を話す日も。<br />AIとの会話で、自分らしい伝え方を練習できます。</p>
    <a class="button primary" href="/#scenes"
      >お相手を選んで体験する <span aria-hidden="true">→</span></a
    >
    <p class="small muted">第1話・3往復はログイン不要</p>
  </header>

  <section aria-labelledby="steps-title">
    <h2 id="steps-title">練習は、3ステップ。</h2>
    <div class="steps">
      {#each steps as step}
        <article class="card step">
          <span class="step-number" aria-hidden="true">{step.number}</span>
          <h3>{step.title}</h3>
          <p>{step.text}</p>
        </article>
      {/each}
    </div>
  </section>

  <section aria-labelledby="length-title">
    <h2 id="length-title">今日は、どのくらい話す？</h2>
    <div class="lengths">
      <article class="card length">
        <p class="eyebrow">気軽にひと練習</p>
        <h3>3往復 <span>／ 1枠</span></h3>
        <p>ひとつの場面で、伝え方を試したい日に。</p>
        <p class="small muted">最大30XP</p>
      </article>
      <article class="card length special">
        <p class="eyebrow">もう少し、近づきたい日に</p>
        <h3>6往復 <span>／ 2枠</span></h3>
        <p>会話の変化まで振り返れる、じっくり練習。</p>
        <p class="reward">場面に合った専用イラストを獲得</p>
        <p class="small muted">最大70XP・ログイン後に利用可能</p>
      </article>
    </div>
  </section>

  <section class="review card" aria-labelledby="review-title">
    <div>
      <p class="eyebrow">自分の会話を知る</p>
      <h2 id="review-title">点数の先に、次のひと言。</h2>
      <p>
        5つの観点を各5点、合計25点で振り返り。<br
        />あなたの発言に沿った改善点と言い換え例が届きます。
      </p>
      <ul class="aspects">
        {#each aspects as aspect}<li>{aspect}</li>{/each}
      </ul>
    </div>
    <div class="score"><strong>25</strong><span>点満点</span></div>
  </section>

  <section aria-labelledby="story-title">
    <h2 id="story-title">練習を重ねて、物語も少しずつ。</h2>
    <ol class="chapters">
      <li>出会い</li>
      <li>デート</li>
      <li>本音</li>
      <li>気持ちを伝える</li>
    </ol>
    <p>
      点数と好感度を積み重ねて、全12話へ。<br />クリア済みの場面に戻って、何度でも再練習できます。
    </p>
    <p class="small muted">
      会話・分析・カードは、思い出アルバムに。6往復のイラストは合否にかかわらず獲得できます。
    </p>
  </section>

  <section class="questions" aria-labelledby="questions-title">
    <h2 id="questions-title">気になったら、ここをチェック。</h2>
    <details>
      <summary>無料でどこまでできる？</summary>
      <p>
        ログインすると毎月10枠。全6人の1〜3話と、共通・カスタム練習を楽しめます。無料枠は毎月1日の日本時間0時に更新され、繰越はありません。
      </p>
      <p>
        Plusは月980円・共通60枠で全員の通常本編が対象。人物パックは1人1,480円・専用24枠、追加の共通15枠は550円です。有料商品の購入は現在準備中です。
      </p>
      <a class="text-link" href="/pricing">料金と遊べる範囲を詳しく見る →</a>
    </details>
    <details>
      <summary>いつログインするの？ 利用枠はいつ減る？</summary>
      <p>
        第2話へ進む、6往復を選ぶ、共通・カスタム練習をする際にGoogleでログインします。ご自身の名前・性別・年齢・性的指向の入力は不要です。お相手は6人の成人キャラクターから選べます。
      </p>
      <p>
        利用枠は最初のAIの返答を正常に保存したときに一度だけ使用します。再開・再送・生成失敗・評価の再試行では追加消費しません。新しくやり直す場合は別の練習です。会話例の閲覧は消費しません。
      </p>
      <p>
        未ログインの体験をログイン後に引き継ぐ際は1枠を使い、会話・評価・XP・カード・クリア判定を保存します。同じ体験で二重に消費することはありません。以前に消費済みの練習への追加消費もありません。
      </p>
    </details>
    <details>
      <summary>クリア・好感度・XPはどう決まる？</summary>
      <p>
        各話の合格点と「距離感・配慮」の最低点を満たすとクリア。前話のクリア・必要好感度・利用権（4話以降はPlusまたは人物パック）が揃うと次の話が開きます。追加の待ち時間や1日当たりの進行制限はありません。
      </p>
      <p>
        採点基準は3往復・6往復で共通です。5観点の数値評価にはJevを利用し、取得できない評価を0点で埋めません。旧基準の履歴には換算であることを表示します。6往復では全6返答と前半から後半の変化も振り返ります。
      </p>
      <p>
        3往復は完了20XP＋ミッション達成10XP、6往復は完了50XP＋ミッション達成20XP。100XPごとにレベルが上がります。レベルは経験の目安です。好感度は人物ごとに変化し、すれ違いは配慮のある会話で回復できます。好感度100でも交際成立が自動で確定するわけではありません。
      </p>
    </details>
    <details>
      <summary>再練習や、言い直しはできる？</summary>
      <p>
        「クリア済みパートを練習」から、その話の時点の関係で再練習できます。利用権と利用枠は必要ですが、物語の進行・選んだ結末・元の会話・分析・獲得済み報酬は残ります。再練習も好感度に反映されます。
      </p>
      <p>
        完了したキャラクター練習では、一度だけひと言を言い直して反応を試せます。この言い直しは利用枠を使わず、元の会話と振り返りも残ります。
      </p>
    </details>
    <details>
      <summary>自分の場面を作りたい</summary>
      <p>
        カスタム練習で、場所・相手との関係・話したいことを500文字以内で設定できます。「2回目のデートの帰りに、また会う約束をしたい」など、具体的に書いてみてください。
      </p>
      <p>
        相手の架空の呼び名・最初のひと言は任意です。ひと言を設定しない場合は、あなたから始めます。設定は保存され、再開・再練習に使えます。3往復1枠で共通枠を使用し、物語の進行は変わりません。
      </p>
    </details>
    <details id="data">
      <summary>会話とデータの扱いについて</summary>
      <ul>
        <li>
          未ログインの体験は同じブラウザのCookieで30日間再開でき、期限後は順次削除します。Cookieを削除すると再開・引き継ぎができなくなるため、残したい会話はログインして保存してください。利用制限のため、IPアドレスは日ごとに変わる不可逆な値として記録します。
        </li>
        <li>
          ログインにはFirebase
          Authenticationを利用します。Googleのプロフィールはアカウント管理のために保存し、会話の初期設定としてAIへ自動送信しません。
        </li>
        <li>
          場面設定・会話をDifyへ送り、返答と振り返りを作ります。数値評価には場面・会話をJevへ送信します。再開・分析のため設定・履歴・結果を保存し、人物との交流では過去の会話の一部を返答に引き継ぎます。実名・連絡先・相手の個人情報は入力しないでください。
        </li>
        <li>
          決済はStripeの画面を使い、Koi-Treではカード番号を保存しません。利用状況の計測にはGoogle
          Analyticsを使いますが、場面設定・会話本文・氏名・メールアドレスを計測イベントに含めません。
        </li>
      </ul>
    </details>
  </section>
  <aside class="hint">
    <p>
      AIの反応は、実際の相手の気持ちを保証するものではありません。<br
      />振り返りをヒントに、自分らしい言葉を見つけてください。
    </p>
    <a class="button secondary" href="/#scenes">練習してみる <span aria-hidden="true">→</span></a>
  </aside>
</div>

<style>
  .guide {
    width: 100%;
    max-width: 62rem;
    margin: 0 auto;
    padding-bottom: 4rem;
  }
  .intro {
    text-align: center;
    padding: 4rem 0 3rem;
  }
  h1 {
    margin: 1rem 0 1.5rem;
    line-height: 1.65;
  }
  .intro > p:not(.eyebrow):not(.small) {
    font-size: var(--text-lead);
    color: var(--muted);
  }
  .intro .button {
    margin-top: 1rem;
  }
  section {
    margin: 2.5rem 0 3.5rem;
  }
  section > h2 {
    margin: 0 0 1.5rem;
  }
  .steps {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1rem;
  }
  .step,
  .length {
    padding: 1.5rem;
  }
  .step-number {
    color: var(--accent);
    font-family: var(--font-editorial);
    font-size: 1.75rem;
  }
  .step h3 {
    font-family: var(--font-body);
    font-size: var(--text-base);
    margin: 1rem 0 0.75rem;
    font-weight: 700;
  }
  .step p,
  .length p {
    font-size: var(--text-sm);
    margin-bottom: 0;
  }
  .step p {
    color: var(--muted);
  }
  .lengths {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }
  .length h3 {
    font-size: var(--heading-md);
    margin: 0.75rem 0;
  }
  .length h3 span {
    font-family: var(--font-body);
    font-size: var(--text-base);
    font-weight: 400;
  }
  .special {
    background: var(--accent-soft);
  }
  .reward {
    color: var(--accent);
    font-weight: 700;
  }
  .review {
    display: flex;
    align-items: center;
    gap: 2rem;
    padding: 2rem;
    background: var(--surface);
  }
  .review h2 {
    margin: 0.75rem 0;
  }
  .review p:not(.eyebrow) {
    font-size: var(--text-sm);
  }
  .aspects {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    list-style: none;
    margin: 1.25rem 0 0;
    padding: 0;
  }
  .aspects li {
    font-size: var(--text-sm);
    padding: 0.4rem 0.65rem;
    border: 1px solid var(--border);
    border-radius: 2rem;
  }
  .score {
    display: flex;
    flex-shrink: 0;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    width: 8rem;
    height: 8rem;
    border: 1px solid var(--border);
    border-radius: 50%;
    color: var(--accent);
    margin-left: auto;
  }
  .score strong {
    font-family: var(--font-editorial);
    font-size: 2.5rem;
    line-height: 1.2;
  }
  .score span {
    font-size: var(--text-sm);
    margin-top: 0.5rem;
  }
  .chapters {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    list-style: none;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 1rem;
    overflow: hidden;
  }
  .chapters li {
    background: var(--surface);
    padding: 1rem 0.5rem;
    text-align: center;
    font-size: var(--text-sm);
  }
  .chapters li + li {
    border-left: 1px solid var(--border);
  }
  .questions details {
    border-top: 1px solid var(--border);
    padding: 1.25rem 0;
  }
  summary {
    cursor: pointer;
    font-weight: 600;
    line-height: 1.7;
  }
  details p,
  details li {
    font-size: var(--text-sm);
    line-height: 1.9;
  }
  details li + li {
    margin-top: 0.75rem;
  }
  details ul {
    padding-left: 1.25rem;
  }
  .hint {
    padding-top: 1.5rem;
    border-top: 1px solid var(--border);
    text-align: center;
  }
  .hint p {
    font-size: var(--text-sm);
    color: var(--muted);
  }
  .hint .button {
    margin-top: 0.75rem;
  }
  @media (max-width: 700px) {
    .intro {
      text-align: left;
      padding: 2.5rem 0 1rem;
    }
    .intro > p:not(.eyebrow):not(.small) {
      font-size: var(--text-base);
    }
    .steps {
      grid-template-columns: 1fr;
    }
    .step {
      padding: 1.25rem;
      display: grid;
      grid-template-columns: 2.5rem 1fr;
      column-gap: 0.75rem;
    }
    .step-number {
      grid-row: span 2;
    }
    .step h3 {
      margin: 0.25rem 0 0.5rem;
    }
    .step p {
      margin: 0;
    }
    .lengths {
      grid-template-columns: 1fr;
    }
    .review {
      padding: 1.5rem;
      flex-wrap: wrap;
      gap: 1rem;
    }
    .score {
      width: 6rem;
      height: 6rem;
      margin: 0;
    }
    .score strong {
      font-size: 2rem;
    }
    .chapters {
      grid-template-columns: 1fr 1fr;
    }
    .chapters li:nth-child(3) {
      border-left: 0;
    }
    .chapters li:nth-child(n + 3) {
      border-top: 1px solid var(--border);
    }
    section {
      margin: 2rem 0 2.5rem;
    }
  }
</style>
