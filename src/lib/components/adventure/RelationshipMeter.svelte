<script lang="ts">
  import { affinityLabel } from '$lib/adventure-progression'
  export let name: string
  export let value: number
  export let required = 0
</script>

<div class="relationship">
  <div class="heading">
    <span>♡ {name}との好感度</span><strong>{value}<small> / 100</small></strong>
  </div>
  <progress max="100" value="{value}" aria-label="{`${name}との好感度${value}、100点満点`}"
  ></progress>
  <p>
    {affinityLabel(value)}{#if required > value}<span>この話まで、あと{required - value}</span>{/if}
  </p>
</div>

<style>
  .relationship {
    padding: 16px 18px;
    border: 1px solid #d9bfc0;
    border-radius: 14px;
    background: linear-gradient(120deg, #fcf2ee, #fbf8f0);
  }
  .heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    font-size: 0.8rem;
    color: #8c514b;
  }
  strong {
    font-size: 1.4rem;
    font-variant-numeric: tabular-nums;
  }
  small {
    font-weight: 400;
    font-size: 0.7rem;
  }
  progress {
    display: block;
    width: 100%;
    height: 7px;
    margin: 12px 0 9px;
    appearance: none;
    border: 0;
    border-radius: 10px;
    overflow: hidden;
    background: #ecdcd7;
  }
  progress::-webkit-progress-bar {
    background: #ecdcd7;
  }
  progress::-webkit-progress-value {
    background: #bb776b;
    border-radius: 10px;
    transition: width 0.4s;
  }
  progress::-moz-progress-bar {
    background: #bb776b;
  }
  p {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
    margin: 0;
    font-size: 0.7rem;
    color: #8b6a61;
  }
  p span {
    color: #a34d3e;
  }
  @media (prefers-reduced-motion: reduce) {
    progress::-webkit-progress-value {
      transition: none;
    }
  }
</style>
