<template>
  <svg
    :width="width"
    :height="height"
    :viewBox="VIEW_BOX.mark"
    xmlns="http://www.w3.org/2000/svg"
    class="gauge"
    :class="{ 'is-indeterminate': isIndeterminate, 'is-complete': complete }"
    aria-hidden="true"
  >
    <defs>
      <linearGradient
        :id="uid('mark')"
        gradientUnits="userSpaceOnUse"
        :x1="markGradient.x1"
        :y1="markGradient.y1"
        :x2="markGradient.x2"
        :y2="markGradient.y2"
      >
        <stop
          v-for="(stop, index) in MARK_STOPS"
          :key="index"
          :offset="stop.offset"
          :stop-color="stop.color"
        />
      </linearGradient>

      <!-- The mark's own outline is the vessel: everything below is a plain
           rectangle, shaped only by this clip. -->
      <clipPath :id="uid('ink')">
        <use v-for="key in SHAPE_KEYS" :key="key" :href="`#${uid(key)}`" />
      </clipPath>
    </defs>

    <path :id="uid('markUpper')" :d="MARK_UPPER" :fill="`url(#${uid('mark')})`" class="ghost" />
    <path :id="uid('markLower')" :d="MARK_LOWER" :fill="`url(#${uid('mark')})`" class="ghost" />
    <path :id="uid('markDot')" :d="MARK_DOT" :fill="`url(#${uid('mark')})`" class="ghost" />

    <g :clip-path="`url(#${uid('ink')})`">
      <rect
        class="gauge-fill"
        :x="MARK_VIEW_BOX_RECT.x"
        :y="MARK_INK_TOP"
        :width="MARK_VIEW_BOX_RECT.w"
        :height="INK_HEIGHT"
        :fill="`url(#${uid('mark')})`"
        :style="fillTransform"
      />
      <!-- Waterline: rides the top edge of the fill, which is what makes slow
           progress legible at a glance. -->
      <rect
        class="gauge-line"
        :x="MARK_VIEW_BOX_RECT.x"
        :y="MARK_INK_TOP"
        :width="MARK_VIEW_BOX_RECT.w"
        height="2.5"
        fill="#EBD3FF"
        :style="fillTransform"
      />
    </g>
  </svg>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'
import {
  ASPECT_RATIO,
  GRADIENTS,
  MARK_DOT,
  MARK_INK_BOTTOM,
  MARK_INK_TOP,
  MARK_LOWER,
  MARK_STOPS,
  MARK_UPPER,
  MARK_VIEW_BOX_RECT,
  VIEW_BOX,
} from './logo-paths'

const props = withDefaults(
  defineProps<{
    /** 0..1 fill level. `null` means "moving, but we cannot say how far". */
    progress?: number | null
    width?: number
    /** The update landed: hold the gauge full and flash once. */
    complete?: boolean
  }>(),
  { progress: null, width: 132, complete: false },
)

const SHAPE_KEYS = ['markUpper', 'markLower', 'markDot'] as const

const INK_HEIGHT = MARK_INK_BOTTOM - MARK_INK_TOP

const instanceId = useId()

function uid(key: string): string {
  return `${instanceId}-${key}`
}

const markGradient = GRADIENTS.find((gradient) => gradient.key === 'mark')!

const height = computed(() => Math.round(props.width / ASPECT_RATIO.mark))

const isIndeterminate = computed(() => !props.complete && props.progress === null)

/**
 * The fill is a full-height rectangle pushed down out of the mark and slid back
 * up. Driving one transform keeps the browser on the compositor, where a value
 * that ticks on every service-worker message belongs.
 */
const fillTransform = computed(() => {
  if (isIndeterminate.value) return undefined
  const ratio = props.complete ? 1 : Math.min(1, Math.max(0, props.progress ?? 0))
  return { transform: `translateY(${(1 - ratio) * INK_HEIGHT}px)` }
})
</script>

<style scoped>
.gauge {
  overflow: visible;
}

.ghost {
  opacity: 0.12;
}

.gauge-fill,
.gauge-line {
  transition: transform 0.3s ease-out;
}

.gauge-line {
  opacity: 0.9;
}

/* Nothing to report yet: swell and ebb instead of faking a percentage. */
.is-indeterminate .gauge-fill,
.is-indeterminate .gauge-line {
  transition: none;
  animation: gauge-tide 2.6s ease-in-out infinite;
}

@keyframes gauge-tide {
  0%,
  100% {
    transform: translateY(118px);
  }
  50% {
    transform: translateY(46px);
  }
}

.is-complete .gauge-fill {
  animation: gauge-flash 0.6s ease-out;
}

@keyframes gauge-flash {
  0% {
    filter: brightness(1);
  }
  35% {
    filter: brightness(1.9);
  }
  100% {
    filter: brightness(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .gauge-fill,
  .gauge-line {
    transition: none;
    animation: none !important;
  }

  .is-indeterminate .gauge-fill,
  .is-indeterminate .gauge-line {
    transform: translateY(75px);
  }
}
</style>
