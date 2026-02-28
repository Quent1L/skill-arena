<template>
  <div
    class="skol-logo"
    :class="{ 'is-loaded': loaded }"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
  >
    <svg
      :width="width"
      :height="height"
      :viewBox="`0 0 ${baseW} ${baseH}`"
      xmlns="http://www.w3.org/2000/svg"
      class="skol-svg"
      role="img"
      aria-label="SKOL - Skill Kills Our Luck"
    >
      <defs>
        <!-- Dégradé texte -->
        <linearGradient id="sk-text" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color: #7c3aed" />
          <stop offset="50%" style="stop-color: #a78bfa" />
          <stop offset="100%" style="stop-color: #c084fc" />
        </linearGradient>

        <!-- Dégradé dé -->
        <linearGradient id="sk-die" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color: #a78bfa" />
          <stop offset="100%" style="stop-color: #7c3aed" />
        </linearGradient>

        <!-- Glow dé -->
        <filter id="sk-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <!-- Glow texte léger -->
        <filter id="sk-text-glow" x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <!-- ===== TEXTE SKOL ===== -->
      <g class="sk-text">
        <text
          x="180"
          y="108"
          font-family="'Exo 2', 'Rajdhani', sans-serif"
          font-size="100"
          font-weight="900"
          fill="url(#sk-text)"
          text-anchor="middle"
          letter-spacing="6"
          filter="url(#sk-text-glow)"
        >
          SKOL
        </text>
      </g>

      <!-- Soulignement animé -->
      <line
        x1="30"
        y1="118"
        x2="330"
        y2="118"
        stroke="url(#sk-text)"
        stroke-width="3"
        stroke-linecap="round"
        opacity="0.35"
        class="sk-underline"
      />

      <!-- ===== DÉ ===== -->
      <g class="sk-die" filter="url(#sk-glow)">
        <!-- Corps dé - carré arrondi penché -->
        <g transform="translate(268, 8) rotate(15, 26, 26)">
          <rect x="0" y="0" width="52" height="52" rx="10" fill="url(#sk-die)" />
          <!-- Reflet haut -->
          <rect x="0" y="0" width="52" height="20" rx="10" fill="rgba(255,255,255,0.18)" />
          <!-- Points face 3 (diagonale) -->
          <circle cx="13" cy="13" r="5.5" fill="white" opacity="0.95" />
          <circle cx="26" cy="26" r="5.5" fill="white" opacity="0.95" />
          <circle cx="39" cy="39" r="5.5" fill="white" opacity="0.95" />
          <!-- Contour subtil -->
          <rect
            x="0"
            y="0"
            width="52"
            height="52"
            rx="10"
            fill="none"
            stroke="rgba(255,255,255,0.15)"
            stroke-width="1.5"
          />
        </g>
      </g>

      <!-- Point d'interrogation sous le dé -->
      <text
        x="303"
        y="76"
        font-family="'Exo 2', sans-serif"
        font-size="16"
        font-weight="900"
        fill="#a78bfa"
        text-anchor="middle"
        opacity="0.7"
        class="sk-question"
      >
        ?
      </text>

      <!-- Petites particules (visibles au hover) -->
      <g class="sk-particles" :class="{ active: hovered }">
        <circle cx="252" cy="18" r="2" fill="#a78bfa" class="p p1" />
        <circle cx="335" cy="35" r="1.5" fill="#c084fc" class="p p2" />
        <circle cx="318" cy="8" r="1.5" fill="#a78bfa" class="p p3" />
        <circle cx="245" cy="42" r="1" fill="#7c3aed" class="p p4" />
        <circle cx="345" cy="15" r="1" fill="#c084fc" class="p p5" />
      </g>
    </svg>
  </div>
</template>

<script>
export default {
  name: 'SkolLogo',

  props: {
    width: {
      type: [Number, String],
      default: 360,
    },
    height: {
      type: [Number, String],
      default: 130,
    },
  },

  data() {
    return {
      loaded: false,
      hovered: false,
      baseW: 360,
      baseH: 130,
    }
  },

  mounted() {
    this.$nextTick(() => {
      setTimeout(() => {
        this.loaded = true
      }, 80)
    })
  },
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Exo+2:wght@900&family=Rajdhani:wght@700&display=swap');

/* ============================
   WRAPPER
   ============================ */
.skol-logo {
  display: inline-block;
  cursor: pointer;
  user-select: none;
}

.skol-svg {
  overflow: visible;
  transition: filter 0.3s ease;
}

.skol-logo:hover .skol-svg {
  filter: drop-shadow(0 0 20px rgba(167, 139, 250, 0.35));
}

/* ============================
   TEXTE — slide depuis la gauche
   ============================ */
.sk-text {
  opacity: 0;
  transform: translateX(-16px);
  animation: none;
}

.is-loaded .sk-text {
  animation: sk-slide-in 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.05s forwards;
}

@keyframes sk-slide-in {
  from {
    opacity: 0;
    transform: translateX(-16px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* ============================
   SOULIGNEMENT — tracé progressif
   ============================ */
.sk-underline {
  stroke-dasharray: 300;
  stroke-dashoffset: 300;
  animation: none;
}

.is-loaded .sk-underline {
  animation: sk-draw 0.5s ease-out 0.45s forwards;
}

@keyframes sk-draw {
  to {
    stroke-dashoffset: 0;
  }
}

/* ============================
   DÉ — drop + rotation + flottement
   ============================ */
.sk-die {
  opacity: 0;
  transform: translateY(-20px) scale(0.7);
  transform-origin: 294px 34px;
  animation: none;
}

.is-loaded .sk-die {
  animation:
    sk-die-drop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s forwards,
    sk-die-float 3s ease-in-out 1s infinite;
}

@keyframes sk-die-drop {
  from {
    opacity: 0;
    transform: translateY(-20px) scale(0.7) rotate(0deg);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1) rotate(0deg);
  }
}

@keyframes sk-die-float {
  0%,
  100% {
    transform: translateY(0) rotate(0deg);
  }
  30% {
    transform: translateY(-5px) rotate(4deg);
  }
  70% {
    transform: translateY(-3px) rotate(-3deg);
  }
}

/* ============================
   POINT D'INTERROGATION — pulse
   ============================ */
.sk-question {
  opacity: 0;
  animation: none;
}

.is-loaded .sk-question {
  animation:
    sk-fade-in 0.4s ease-out 0.7s forwards,
    sk-q-pulse 2.5s ease-in-out 1.5s infinite;
}

@keyframes sk-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 0.7;
  }
}

@keyframes sk-q-pulse {
  0%,
  100% {
    opacity: 0.4;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.25);
  }
}

/* ============================
   PARTICULES — hover
   ============================ */
.sk-particles .p {
  opacity: 0;
  transform: scale(0);
}

.sk-particles.active .p {
  animation: sk-particle 1s ease-out infinite;
}

.p1 {
  animation-delay: 0s !important;
}
.p2 {
  animation-delay: 0.15s !important;
}
.p3 {
  animation-delay: 0.3s !important;
}
.p4 {
  animation-delay: 0.45s !important;
}
.p5 {
  animation-delay: 0.6s !important;
}

@keyframes sk-particle {
  0% {
    opacity: 0;
    transform: scale(0) translate(0, 0);
  }
  40% {
    opacity: 1;
    transform: scale(1.5) translate(0, -6px);
  }
  100% {
    opacity: 0;
    transform: scale(0) translate(0, -14px);
  }
}
</style>
