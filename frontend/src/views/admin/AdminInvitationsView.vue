<template>
  <div class="p-6">
    <div class="mb-6">
      <h1 class="text-3xl font-bold mb-2">{{ t('adminInvitationsView.title') }}</h1>
      <p class="text-gray-600">{{ t('adminInvitationsView.subtitle') }}</p>
    </div>

    <Card class="mb-6">
      <template #title>
        <div class="flex items-center gap-2">
          <i class="fa fa-plus-circle"></i>
          {{ t('adminInvitationsView.generateNewCode') }}
        </div>
      </template>
      <template #content>
        <form @submit.prevent="handleGenerateCode" class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="flex flex-col gap-2">
            <label for="maxUses" class="font-medium">{{ t('adminInvitationsView.maxUses') }}</label>
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
            <label for="expiresInDays" class="font-medium">{{ t('adminInvitationsView.expirationDays') }}</label>
            <InputNumber
              id="expiresInDays"
              v-model="formData.expiresInDays"
              :min="1"
              :max="365"
              show-buttons
              button-layout="horizontal"
              class="w-full"
              :placeholder="t('adminInvitationsView.noExpiration')"
            />
          </div>

          <div class="flex flex-col gap-2">
            <label for="notes" class="font-medium">{{ t('adminInvitationsView.notesOptional') }}</label>
            <InputText
              id="notes"
              v-model="formData.notes"
              :placeholder="t('adminInvitationsView.notesPlaceholder')"
              class="w-full"
            />
          </div>

          <div class="flex flex-col gap-2">
            <label for="organizationId" class="font-medium">{{ t('adminInvitationsView.organizationOptional') }}</label>
            <Select
              id="organizationId"
              v-model="formData.organizationId"
              :options="organizations"
              option-label="name"
              option-value="id"
              :placeholder="t('adminInvitationsView.generalAccess')"
              class="w-full"
              show-clear
            />
          </div>

          <div class="md:col-span-3">
            <Button
              type="submit"
              :loading="isGenerating"
              :label="t('adminInvitationsView.generateCode')"
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
          {{ t('adminInvitationsView.existingCodes') }}
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
              {{ t('adminInvitationsView.noCodes') }}
            </div>
          </template>

          <Column field="code" :header="t('adminInvitationsView.columnCode')" sortable>
            <template #body="{ data }">
              <div class="flex items-center gap-2">
                <code class="px-2 py-1 rounded font-mono text-sm">
                  {{ data.code }}
                </code>
                <Button
                  icon="fa fa-copy"
                  text
                  rounded
                  size="small"
                  @click="copyToClipboard(data.code)"
                  v-tooltip="t('adminInvitationsView.copyCode')"
                />
                <Button
                  icon="fa fa-link"
                  text
                  rounded
                  size="small"
                  @click="copySignupUrl(data.code)"
                  v-tooltip="t('adminInvitationsView.copySignupLink')"
                />
              </div>
            </template>
          </Column>

          <Column field="usedCount" :header="t('adminInvitationsView.columnUsages')" sortable>
            <template #body="{ data }">
              <Tag :severity="data.usedCount >= data.maxUses ? 'danger' : 'success'">
                {{ data.usedCount }} / {{ data.maxUses }}
              </Tag>
            </template>
          </Column>

          <Column field="isActive" :header="t('common.status')" sortable>
            <template #body="{ data }">
              <Tag :severity="data.isActive ? 'success' : 'secondary'">
                {{ data.isActive ? t('adminInvitationsView.statusActive') : t('adminInvitationsView.statusInactive') }}
              </Tag>
            </template>
          </Column>

          <Column field="expiresAt" :header="t('adminInvitationsView.columnExpiration')" sortable>
            <template #body="{ data }">
              <span v-if="data.expiresAt">
                {{ formatDate(data.expiresAt) }}
              </span>
              <span v-else class="text-gray-500">{{ t('adminInvitationsView.noExpirationValue') }}</span>
            </template>
          </Column>

          <Column field="creator.displayName" :header="t('adminInvitationsView.columnCreator')" sortable />

          <Column field="createdAt" :header="t('adminInvitationsView.columnCreatedAt')" sortable>
            <template #body="{ data }">
              {{ formatDate(data.createdAt) }}
            </template>
          </Column>

          <Column field="notes" :header="t('adminInvitationsView.columnNotes')">
            <template #body="{ data }">
              <span v-if="data.notes" class="text-sm text-gray-600">
                {{ data.notes }}
              </span>
              <span v-else class="text-gray-400">-</span>
            </template>
          </Column>

          <Column :header="t('common.actions')" :exportable="false">
            <template #body="{ data }">
              <Button
                v-if="data.isActive"
                icon="fa fa-ban"
                text
                rounded
                severity="danger"
                size="small"
                @click="handleDeactivate(data)"
                v-tooltip="t('adminInvitationsView.deactivate')"
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
import { useI18n } from 'vue-i18n'
import { useAppToast } from '@/composables/useAppToast'
import { useInvitationService } from '@/composables/invitation/invitation.service'
import { useOrganizationService } from '@/composables/organization/organization.service'
import type { InvitationCode } from '@/composables/invitation/invitation.api'
import type { OrganizationWithMemberCount } from '@skol-arena/shared'

const { t } = useI18n()
const toast = useAppToast()
const { generateCode, getAllCodes, deactivateCode } = useInvitationService()
const { listOrganizations } = useOrganizationService()

const codes = ref<InvitationCode[]>([])
const organizations = ref<OrganizationWithMemberCount[]>([])
const isLoading = ref(false)
const isGenerating = ref(false)

const formData = ref({
  maxUses: 1,
  expiresInDays: undefined as number | undefined,
  notes: '',
  organizationId: undefined as string | undefined,
})

onMounted(async () => {
  await Promise.all([loadCodes(), loadOrganizations()])
})

async function loadOrganizations() {
  try {
    organizations.value = await listOrganizations()
  } catch {
    // non-critical, ignore
  }
}

async function loadCodes() {
  isLoading.value = true
  try {
    codes.value = await getAllCodes()
  } catch (error: unknown) {
    toast.add({
      severity: 'error',
      summary: t('adminInvitationsView.errorSummary'),
      detail: (error as Error).message || t('adminInvitationsView.errorLoadCodes'),
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
      organizationId: formData.value.organizationId,
    })

    toast.add({
      severity: 'success',
      summary: t('adminInvitationsView.codeCreatedSummary'),
      detail: t('adminInvitationsView.codeCreatedDetail', { code: newCode.code }),
      life: 5000,
    })

    formData.value = {
      maxUses: 1,
      expiresInDays: undefined,
      notes: '',
      organizationId: undefined,
    }

    await loadCodes()
  } catch (error: unknown) {
    toast.add({
      severity: 'error',
      summary: t('adminInvitationsView.errorSummary'),
      detail: (error as Error).message || t('adminInvitationsView.errorGenerateCode'),
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
      summary: t('adminInvitationsView.codeDeactivatedSummary'),
      detail: t('adminInvitationsView.codeDeactivatedDetail', { code: code.code }),
      life: 3000,
    })
    await loadCodes()
  } catch (error: unknown) {
    toast.add({
      severity: 'error',
      summary: t('adminInvitationsView.errorSummary'),
      detail: (error as Error).message || t('adminInvitationsView.errorDeactivateCode'),
      life: 3000,
    })
  }
}

function copyToClipboard(code: string) {
  navigator.clipboard.writeText(code)
  toast.add({
    severity: 'success',
    summary: t('adminInvitationsView.copiedSummary'),
    detail: t('adminInvitationsView.codeCopiedDetail'),
    life: 2000,
  })
}

function copySignupUrl(code: string) {
  const baseUrl = window.location.origin
  const url = `${baseUrl}/signup?code=${code}`
  navigator.clipboard.writeText(url)
  toast.add({
    severity: 'success',
    summary: t('adminInvitationsView.copiedSummary'),
    detail: t('adminInvitationsView.signupLinkCopiedDetail'),
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
