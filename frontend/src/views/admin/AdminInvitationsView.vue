<template>
  <div class="p-6">
    <div class="mb-6">
      <h1 class="text-3xl font-bold mb-2">Gestion des codes d'invitation</h1>
      <p class="text-gray-600">Créez et gérez les codes d'invitation pour l'inscription des utilisateurs</p>
    </div>

    <Card class="mb-6">
      <template #title>
        <div class="flex items-center gap-2">
          <i class="fa fa-plus-circle"></i>
          Générer un nouveau code
        </div>
      </template>
      <template #content>
        <form @submit.prevent="handleGenerateCode" class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="flex flex-col gap-2">
            <label for="maxUses" class="font-medium">Nombre d'utilisations</label>
            <InputNumber
              id="maxUses"
              v-model="formData.maxUses"
              :min="1"
              :max="100"
              show-buttons
              button-layout="horizontal"
              class="w-full"
            />
          </div>

          <div class="flex flex-col gap-2">
            <label for="expiresInDays" class="font-medium">Expiration (jours)</label>
            <InputNumber
              id="expiresInDays"
              v-model="formData.expiresInDays"
              :min="1"
              :max="365"
              show-buttons
              button-layout="horizontal"
              class="w-full"
              placeholder="Pas d'expiration"
            />
          </div>

          <div class="flex flex-col gap-2">
            <label for="notes" class="font-medium">Notes (optionnel)</label>
            <InputText
              id="notes"
              v-model="formData.notes"
              placeholder="Ex: Pour les nouveaux joueurs"
              class="w-full"
            />
          </div>

          <div class="md:col-span-3">
            <Button
              type="submit"
              :loading="isGenerating"
              label="Générer le code"
              icon="fa fa-plus"
              class="w-full md:w-auto"
            />
          </div>
        </form>
      </template>
    </Card>

    <Card>
      <template #title>
        <div class="flex items-center gap-2">
          <i class="fa fa-list"></i>
          Codes existants
        </div>
      </template>
      <template #content>
        <DataTable
          :value="codes"
          :loading="isLoading"
          paginator
          :rows="10"
          :rows-per-page-options="[10, 25, 50]"
          striped-rows
          removable-sort
          sort-field="createdAt"
          :sort-order="-1"
        >
          <template #empty>
            <div class="text-center py-6 text-gray-500">
              Aucun code d'invitation pour le moment
            </div>
          </template>

          <Column field="code" header="Code" sortable>
            <template #body="{ data }">
              <div class="flex items-center gap-2">
                <code class="bg-gray-100 px-2 py-1 rounded font-mono text-sm">
                  {{ data.code }}
                </code>
                <Button
                  icon="fa fa-copy"
                  text
                  rounded
                  size="small"
                  @click="copyToClipboard(data.code)"
                  v-tooltip="'Copier le code'"
                />
                <Button
                  icon="fa fa-link"
                  text
                  rounded
                  size="small"
                  @click="copySignupUrl(data.code)"
                  v-tooltip="'Copier le lien d\'inscription'"
                />
              </div>
            </template>
          </Column>

          <Column field="usedCount" header="Utilisations" sortable>
            <template #body="{ data }">
              <Tag :severity="data.usedCount >= data.maxUses ? 'danger' : 'success'">
                {{ data.usedCount }} / {{ data.maxUses }}
              </Tag>
            </template>
          </Column>

          <Column field="isActive" header="Statut" sortable>
            <template #body="{ data }">
              <Tag :severity="data.isActive ? 'success' : 'secondary'">
                {{ data.isActive ? 'Actif' : 'Désactivé' }}
              </Tag>
            </template>
          </Column>

          <Column field="expiresAt" header="Expiration" sortable>
            <template #body="{ data }">
              <span v-if="data.expiresAt">
                {{ formatDate(data.expiresAt) }}
              </span>
              <span v-else class="text-gray-500">Aucune</span>
            </template>
          </Column>

          <Column field="creator.displayName" header="Créateur" sortable />

          <Column field="createdAt" header="Créé le" sortable>
            <template #body="{ data }">
              {{ formatDate(data.createdAt) }}
            </template>
          </Column>

          <Column field="notes" header="Notes">
            <template #body="{ data }">
              <span v-if="data.notes" class="text-sm text-gray-600">
                {{ data.notes }}
              </span>
              <span v-else class="text-gray-400">-</span>
            </template>
          </Column>

          <Column header="Actions" :exportable="false">
            <template #body="{ data }">
              <Button
                v-if="data.isActive"
                icon="fa fa-ban"
                text
                rounded
                severity="danger"
                size="small"
                @click="handleDeactivate(data)"
                v-tooltip="'Désactiver'"
              />
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useToast } from 'primevue/usetoast'
import { useInvitationService } from '@/composables/invitation/invitation.service'
import type { InvitationCode } from '@/composables/invitation/invitation.api'

const toast = useToast()
const { generateCode, getAllCodes, deactivateCode } = useInvitationService()

const codes = ref<InvitationCode[]>([])
const isLoading = ref(false)
const isGenerating = ref(false)

const formData = ref({
  maxUses: 1,
  expiresInDays: undefined as number | undefined,
  notes: '',
})

onMounted(async () => {
  await loadCodes()
})

async function loadCodes() {
  isLoading.value = true
  try {
    codes.value = await getAllCodes()
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail: error.message || 'Erreur lors du chargement des codes',
      life: 3000,
    })
  } finally {
    isLoading.value = false
  }
}

async function handleGenerateCode() {
  isGenerating.value = true
  try {
    const newCode = await generateCode({
      maxUses: formData.value.maxUses,
      expiresInDays: formData.value.expiresInDays,
      notes: formData.value.notes || undefined,
    })

    toast.add({
      severity: 'success',
      summary: 'Code créé',
      detail: `Le code ${newCode.code} a été créé avec succès`,
      life: 5000,
    })

    formData.value = {
      maxUses: 1,
      expiresInDays: undefined,
      notes: '',
    }

    await loadCodes()
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail: error.message || 'Erreur lors de la génération du code',
      life: 3000,
    })
  } finally {
    isGenerating.value = false
  }
}

async function handleDeactivate(code: InvitationCode) {
  try {
    await deactivateCode(code.id)
    toast.add({
      severity: 'success',
      summary: 'Code désactivé',
      detail: `Le code ${code.code} a été désactivé`,
      life: 3000,
    })
    await loadCodes()
  } catch (error: any) {
    toast.add({
      severity: 'error',
      summary: 'Erreur',
      detail: error.message || 'Erreur lors de la désactivation du code',
      life: 3000,
    })
  }
}

function copyToClipboard(code: string) {
  navigator.clipboard.writeText(code)
  toast.add({
    severity: 'success',
    summary: 'Copié',
    detail: 'Code copié dans le presse-papier',
    life: 2000,
  })
}

function copySignupUrl(code: string) {
  const baseUrl = window.location.origin
  const url = `${baseUrl}/signup?code=${code}`
  navigator.clipboard.writeText(url)
  toast.add({
    severity: 'success',
    summary: 'Copié',
    detail: 'Lien d\'inscription copié dans le presse-papier',
    life: 2000,
  })
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>
