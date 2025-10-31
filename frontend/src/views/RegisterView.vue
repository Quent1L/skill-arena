<template>
  <div class="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full">
      <div class="text-center mb-8">
        <h1 class="text-4xl font-bold">Skill Arena</h1>
        <p class="mt-2">Créez votre compte</p>
      </div>

      <Card>
        <template #content>
          <form @submit.prevent="handleSubmit" class="space-y-6">
            <div class="flex flex-col gap-2">
              <label for="email" class="font-medium">Adresse email</label>
              <InputText
                id="email"
                v-model="email"
                type="email"
                placeholder="vous@exemple.com"
                required
                :disabled="loading"
                class="w-full"
              />
            </div>

            <div class="flex flex-col gap-2">
              <label for="username" class="font-medium">Nom d'utilisateur</label>
              <InputText
                id="username"
                v-model="username"
                type="text"
                placeholder="johndoe"
                required
                :disabled="loading"
                class="w-full"
              />
            </div>

            <div class="flex flex-col gap-2">
              <label for="name" class="font-medium">Nom complet (optionnel)</label>
              <InputText
                id="name"
                v-model="name"
                type="text"
                placeholder="John Doe"
                :disabled="loading"
                class="w-full"
              />
            </div>

            <div class="flex flex-col gap-2">
              <label for="password" class="font-medium">Mot de passe</label>
              <Password
                id="password"
                v-model="password"
                :feedback="false"
                toggle-mask
                required
                :disabled="loading"
                class="w-full"
                input-class="w-full"
                :invalid="password.length > 0 && password.length < 8"
              />
              <small v-if="password.length > 0 && password.length < 8" class="text-red-500">
                Minimum 8 caractères
              </small>
            </div>

            <div class="flex flex-col gap-2">
              <label for="passwordConfirm" class="font-medium"> Confirmer le mot de passe </label>
              <Password
                id="passwordConfirm"
                v-model="passwordConfirm"
                :feedback="false"
                toggle-mask
                required
                :disabled="loading"
                class="w-full"
                input-class="w-full"
                :invalid="!passwordsMatch"
              />
              <small v-if="!passwordsMatch" class="text-red-500">
                Les mots de passe ne correspondent pas
              </small>
            </div>

            <Message v-if="error || localError" severity="error" :closable="false">
              {{ error || localError }}
            </Message>

            <Message severity="info" :closable="false">
              En créant un compte, vous pourrez participer aux tournois et suivre vos statistiques.
            </Message>

            <div class="space-y-3">
              <Button
                type="submit"
                :loading="loading"
                :disabled="!isFormValid || loading"
                label="Créer mon compte"
                class="w-full"
              />

              <div class="text-center text-sm">
                <span class="text-gray-600">Déjà un compte ?</span>
                <Button link label="Se connecter" @click="router.push('/login')" class="ml-1 p-0" />
              </div>

              <div class="text-center">
                <Button
                  link
                  label="← Retour à l'accueil"
                  @click="router.push('/')"
                  class="text-sm text-gray-600"
                />
              </div>
            </div>
          </form>
        </template>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

const router = useRouter()
const route = useRoute()
const { register, loading, error } = useAuth()

const email = ref('')
const username = ref('')
const name = ref('')
const password = ref('')
const passwordConfirm = ref('')
const localError = ref<string | null>(null)

const passwordsMatch = computed(() => {
  if (!password.value || !passwordConfirm.value) return true
  return password.value === passwordConfirm.value
})

const isFormValid = computed(() => {
  return (
    email.value &&
    username.value &&
    password.value &&
    passwordConfirm.value &&
    passwordsMatch.value &&
    password.value.length >= 8
  )
})

function handleSubmit() {
  localError.value = null

  if (!isFormValid.value) {
    if (!passwordsMatch.value) {
      localError.value = 'Les mots de passe ne correspondent pas'
    } else if (password.value.length < 8) {
      localError.value = 'Le mot de passe doit contenir au moins 8 caractères'
    } else {
      localError.value = 'Veuillez remplir tous les champs obligatoires'
    }
    return
  }

  register({
    email: email.value,
    username: username.value,
    name: name.value || undefined,
    password: password.value,
    passwordConfirm: passwordConfirm.value,
  })
    .then(() => {
      const redirectPath = route.query.redirect as string
      router.push(redirectPath || '/tournaments')
    })
    .catch((err) => {
      console.error("Erreur d'inscription:", err)
    })
}
</script>
