<template>
  <div>
    <Message v-if="validationResult && !validationResult.valid" severity="error" class="mb-6">
      <div>
        <strong>Erreurs de validation :</strong>
        <ul class="mt-2 list-disc list-inside">
          <li v-for="error in validationResult.errors" :key="error">{{ error }}</li>
        </ul>
      </div>
    </Message>

    <Message
      v-if="validationResult && validationResult.warnings.length > 0"
      severity="warn"
      class="mb-6"
    >
      <div>
        <strong>Avertissements :</strong>
        <ul class="mt-2 list-disc list-inside">
          <li v-for="warning in validationResult.warnings" :key="warning">{{ warning }}</li>
        </ul>
      </div>
    </Message>

    <Message v-if="matchCreated" severity="success" class="mb-6">
      Match créé avec succès ! Redirection vers la page du match...
    </Message>
  </div>
</template>

<script setup lang="ts">
interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

interface Props {
  validationResult: ValidationResult | null
  matchCreated?: boolean
}

defineProps<Props>()
</script>
