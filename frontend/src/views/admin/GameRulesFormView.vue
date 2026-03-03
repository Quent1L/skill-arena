<template>
  <div class="game-rules-form-view p-4">
    <div class="flex items-center gap-3 mb-6">
      <Button icon="fa fa-arrow-left" text rounded @click="router.push('/admin/rules')" />
      <h1 class="text-2xl font-bold">
        {{ isEditMode ? 'Modifier le règlement' : 'Nouveau règlement' }}
      </h1>
    </div>

    <Message v-if="error" severity="error" :closable="true" class="mb-4">
      {{ error }}
    </Message>

    <form @submit="onSubmit" class="max-w-4xl">
      <Card>
        <template #content>
          <div class="space-y-4">
            <!-- Titre -->
            <div>
              <label for="title" class="block text-sm font-medium mb-2">
                Titre <span class="text-red-500">*</span>
              </label>
              <InputText
                id="title"
                v-model="title"
                class="w-full"
                :class="{ 'p-invalid': errors.title }"
                placeholder="Ex: Règlement officiel saison 2026"
              />
              <small class="p-error">{{ errors.title }}</small>
            </div>

            <!-- Contenu WYSIWYG -->
            <div>
              <label class="block text-sm font-medium mb-2">
                Contenu <span class="text-red-500">*</span>
              </label>
              <RichTextEditor v-model="content" />
              <small class="p-error">{{ errors.content }}</small>
            </div>

            <!-- Actions -->
            <div class="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
              <Button
                label="Annuler"
                severity="secondary"
                @click="router.push('/admin/rules')"
                :disabled="loading"
                class="w-full sm:w-auto"
              />
              <Button
                type="submit"
                :label="isEditMode ? 'Mettre à jour' : 'Créer'"
                icon="fa fa-check"
                :loading="loading"
                class="w-full sm:w-auto"
              />
            </div>
          </div>
        </template>
      </Card>
    </form>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { createGameRuleSchema, updateGameRuleSchema } from '@skill-arena/shared/types/index'
import { useGameRulesService } from '@/composables/game-rules/game-rules.service'
import RichTextEditor from '@/components/editor/RichTextEditor.vue'

const router = useRouter()
const route = useRoute()
const { currentRule, loading, error, loadRuleById, createRule, updateRule } = useGameRulesService()

const isEditMode = computed(() => !!route.params.id && route.params.id !== 'new')

const { handleSubmit, defineField, errors, setValues } = useForm({
  validationSchema: toTypedSchema(isEditMode.value ? updateGameRuleSchema : createGameRuleSchema),
})

const [title] = defineField('title')
const [content] = defineField('content')

const onSubmit = handleSubmit(async (values) => {
  if (isEditMode.value && route.params.id) {
    const updated = await updateRule(route.params.id as string, values)
    if (updated) router.push('/admin/rules')
  } else {
    const created = await createRule(values as { title: string; content: string })
    if (created) router.push('/admin/rules')
  }
})

onMounted(async () => {
  if (isEditMode.value && route.params.id) {
    await loadRuleById(route.params.id as string)
    if (currentRule.value) {
      setValues({
        title: currentRule.value.title,
        content: currentRule.value.content,
      })
    }
  }
})
</script>

<style scoped>
.game-rules-form-view {
  max-width: 1200px;
  margin: 0 auto;
}
</style>
