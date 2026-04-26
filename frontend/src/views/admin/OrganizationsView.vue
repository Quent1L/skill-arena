<template>
  <div class="p-6">
    <div class="mb-6">
      <h1 class="text-3xl font-bold mb-2">Gestion des organisations</h1>
      <p class="text-gray-600">Créez et gérez les groupes d'utilisateurs pour restreindre l'accès aux tournois</p>
    </div>

    <Card class="mb-6">
      <template #title>
        <div class="flex items-center gap-2">
          <i class="fa fa-plus-circle"></i>
          Créer une organisation
        </div>
      </template>
      <template #content>
        <form @submit.prevent="handleCreate" class="flex gap-4 items-end">
          <div class="flex flex-col gap-2 flex-1">
            <label for="orgName" class="font-medium">Nom de l'organisation</label>
            <InputText
              id="orgName"
              v-model="newOrgName"
              placeholder="Ex: Club de tennis"
              class="w-full"
              :class="{ 'p-invalid': createError }"
            />
            <small v-if="createError" class="p-error">{{ createError }}</small>
          </div>
          <Button type="submit" :loading="isCreating" label="Créer" icon="fa fa-plus" />
        </form>
      </template>
    </Card>

    <Card>
      <template #title>
        <div class="flex items-center gap-2">
          <i class="fa fa-list"></i>
          Organisations existantes
        </div>
      </template>
      <template #content>
        <DataTable :value="organizations" :loading="isLoading" striped-rows removable-sort>
          <template #empty>
            <div class="text-center py-6 text-gray-500">Aucune organisation pour le moment</div>
          </template>

          <Column field="name" header="Nom" sortable />

          <Column field="memberCount" header="Membres" sortable>
            <template #body="{ data }">
              <Tag severity="info">{{ data.memberCount }} membre{{ data.memberCount > 1 ? 's' : '' }}</Tag>
            </template>
          </Column>

          <Column field="createdAt" header="Créée le" sortable>
            <template #body="{ data }">
              {{ formatDate(data.createdAt) }}
            </template>
          </Column>

          <Column header="Actions" :exportable="false">
            <template #body="{ data }">
              <Button icon="fa fa-cog" label="Gérer" size="small" text @click="openManageDialog(data)" />
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <!-- Management Dialog -->
    <Dialog
      v-model:visible="showManageDialog"
      :header="`Gérer : ${selectedOrg?.name}`"
      :modal="true"
      :style="{ width: '700px' }"
      @hide="closeManageDialog"
    >
      <!-- Rename section -->
      <div class="mb-6">
        <h3 class="text-lg font-semibold mb-3">Nom de l'organisation</h3>
        <div class="flex gap-2 items-center">
          <InputText
            v-model="editingName"
            class="flex-1"
            placeholder="Nom de l'organisation"
            :maxlength="100"
          />
          <Button
            label="Enregistrer"
            icon="fa fa-check"
            size="small"
            :loading="isSavingName"
            :disabled="!editingName.trim() || editingName.trim() === selectedOrg?.name"
            @click="handleSaveName"
          />
        </div>
      </div>

      <Divider />

      <!-- Members section -->
      <div>
        <div class="flex justify-between items-center mb-3">
          <h3 class="text-lg font-semibold">
            Membres
            <Tag severity="info" class="ml-2">{{ members.length }}</Tag>
          </h3>
          <Button label="Ajouter" icon="fa fa-user-plus" size="small" @click="showAddMemberDialog = true" />
        </div>

        <div v-if="isLoadingMembers" class="flex justify-center py-4">
          <ProgressSpinner />
        </div>

        <div v-else-if="members.length === 0" class="text-center py-4 text-gray-500">
          Aucun membre
        </div>

        <div v-else class="flex flex-col gap-2">
          <div
            v-for="member in members"
            :key="member.id"
            class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
          >
            <Avatar :label="member.user.displayName.charAt(0).toUpperCase()" class="bg-blue-500 shrink-0" />
            <div class="flex-1 min-w-0">
              <div class="font-medium truncate">{{ member.user.displayName }}</div>
              <div class="flex items-center gap-2 mt-0.5">
                <Tag :severity="member.role === 'owner' ? 'warning' : 'secondary'" size="small">
                  {{ member.role === 'owner' ? 'Propriétaire' : 'Membre' }}
                </Tag>
                <span class="text-sm text-gray-500">Ajouté le {{ formatDate(member.joinedAt) }}</span>
              </div>
            </div>
            <Button
              icon="fa fa-user-minus"
              severity="danger"
              text
              rounded
              size="small"
              v-tooltip="'Retirer'"
              @click="handleRemoveMember(member.userId)"
            />
          </div>
        </div>
      </div>

      <!-- Add member sub-dialog -->
      <Dialog
        v-model:visible="showAddMemberDialog"
        header="Ajouter des membres"
        :modal="true"
        :style="{ width: '500px' }"
        @hide="selectedUserIds = []"
      >
        <div class="flex flex-col gap-4">
          <div v-if="isLoadingUsers" class="flex justify-center py-4">
            <ProgressSpinner />
          </div>
          <div v-else>
            <label for="addMembersSelect" class="block text-sm font-medium mb-2">Sélectionner des utilisateurs</label>
            <MultiSelect
              inputId="addMembersSelect"
              v-model="selectedUserIds"
              :options="availableUsers"
              option-label="displayName"
              option-value="id"
              placeholder="Choisir un ou plusieurs utilisateurs"
              class="w-full"
              filter
              display="chip"
            />
          </div>
        </div>
        <template #footer>
          <Button
            label="Annuler"
            severity="secondary"
            @click="showAddMemberDialog = false"
            :disabled="isAddingMembers"
          />
          <Button
            label="Ajouter"
            icon="fa fa-check"
            :disabled="selectedUserIds.length === 0 || isAddingMembers"
            :loading="isAddingMembers"
            @click="handleAddMembers"
          />
        </template>
      </Dialog>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useToast } from 'primevue/usetoast'
import { useOrganizationService } from '@/composables/organization/organization.service'
import { useUserService } from '@/composables/user/user.service'
import type { OrganizationWithMemberCount, OrganizationMemberWithUser } from '@skill-arena/shared'

const toast = useToast()
const { listOrganizations, createOrganization, getMembers, addMember, removeMember, renameOrganization } = useOrganizationService()
const { users, loading: isLoadingUsers, listUsers } = useUserService()

const organizations = ref<OrganizationWithMemberCount[]>([])
const isLoading = ref(false)
const isCreating = ref(false)
const newOrgName = ref('')
const createError = ref<string | null>(null)

// Management dialog state
const selectedOrg = ref<OrganizationWithMemberCount | null>(null)
const showManageDialog = ref(false)
const members = ref<OrganizationMemberWithUser[]>([])
const isLoadingMembers = ref(false)
const editingName = ref('')
const isSavingName = ref(false)
const showAddMemberDialog = ref(false)
const selectedUserIds = ref<string[]>([])
const isAddingMembers = ref(false)

const memberUserIds = computed(() => members.value.map((m) => m.userId))
const availableUsers = computed(() => users.value.filter((u) => !memberUserIds.value.includes(u.id)))

onMounted(loadOrganizations)

async function loadOrganizations() {
  isLoading.value = true
  try {
    organizations.value = await listOrganizations()
  } catch (error: unknown) {
    toast.add({ severity: 'error', summary: 'Erreur', detail: error instanceof Error ? error.message : 'Erreur lors du chargement', life: 3000 })
  } finally {
    isLoading.value = false
  }
}

async function handleCreate() {
  if (!newOrgName.value.trim()) {
    createError.value = 'Le nom est requis'
    return
  }
  createError.value = null
  isCreating.value = true
  try {
    await createOrganization(newOrgName.value.trim())
    toast.add({ severity: 'success', summary: 'Organisation créée', detail: `L'organisation "${newOrgName.value}" a été créée`, life: 3000 })
    newOrgName.value = ''
    await loadOrganizations()
  } catch (error: unknown) {
    toast.add({ severity: 'error', summary: 'Erreur', detail: error instanceof Error ? error.message : 'Erreur lors de la création', life: 3000 })
  } finally {
    isCreating.value = false
  }
}

async function openManageDialog(org: OrganizationWithMemberCount) {
  selectedOrg.value = org
  editingName.value = org.name
  showManageDialog.value = true
  isLoadingMembers.value = true
  try {
    members.value = await getMembers(org.id)
  } finally {
    isLoadingMembers.value = false
  }
}

function closeManageDialog() {
  selectedOrg.value = null
  members.value = []
  selectedUserIds.value = []
}

async function handleSaveName() {
  if (!selectedOrg.value || !editingName.value.trim()) return
  isSavingName.value = true
  try {
    await renameOrganization(selectedOrg.value.id, editingName.value.trim())
    const name = editingName.value.trim()
    const idx = organizations.value.findIndex((o) => o.id === selectedOrg.value!.id)
    if (idx !== -1) organizations.value[idx].name = name
    selectedOrg.value.name = name
    toast.add({ severity: 'success', summary: 'Renommée', detail: `Organisation renommée en "${name}"`, life: 3000 })
  } catch (error: unknown) {
    toast.add({ severity: 'error', summary: 'Erreur', detail: error instanceof Error ? error.message : 'Erreur lors du renommage', life: 3000 })
  } finally {
    isSavingName.value = false
  }
}

async function handleRemoveMember(userId: string) {
  if (!selectedOrg.value) return
  try {
    await removeMember(selectedOrg.value.id, userId)
    members.value = members.value.filter((m) => m.userId !== userId)
    const idx = organizations.value.findIndex((o) => o.id === selectedOrg.value!.id)
    if (idx !== -1) organizations.value[idx].memberCount--
    toast.add({ severity: 'success', summary: 'Membre retiré', life: 2000 })
  } catch (error: unknown) {
    toast.add({ severity: 'error', summary: 'Erreur', detail: error instanceof Error ? error.message : 'Erreur', life: 3000 })
  }
}

async function handleAddMembers() {
  if (!selectedOrg.value || selectedUserIds.value.length === 0) return
  isAddingMembers.value = true
  try {
    await Promise.all(selectedUserIds.value.map((uid) => addMember(selectedOrg.value!.id, uid)))
    members.value = await getMembers(selectedOrg.value.id)
    const idx = organizations.value.findIndex((o) => o.id === selectedOrg.value!.id)
    if (idx !== -1) organizations.value[idx].memberCount = members.value.length
    showAddMemberDialog.value = false
    selectedUserIds.value = []
    toast.add({ severity: 'success', summary: 'Membres ajoutés', life: 2000 })
  } catch (error: unknown) {
    toast.add({ severity: 'error', summary: 'Erreur', detail: error instanceof Error ? error.message : 'Erreur', life: 3000 })
  } finally {
    isAddingMembers.value = false
  }
}

watch(showAddMemberDialog, async (visible) => {
  if (visible && users.value.length === 0) {
    await listUsers()
  }
})

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })
}
</script>
