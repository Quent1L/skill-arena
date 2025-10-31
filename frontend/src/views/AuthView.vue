<script setup lang="ts">
import { ref } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useRouter } from 'vue-router'

const router = useRouter()
const { login, register, loading, error } = useAuth()

const isLoginMode = ref(true)
const form = ref({
  email: '',
  password: '',
  name: '',
})

const handleSubmit = async () => {
  try {
    if (isLoginMode.value) {
      await login({
        email: form.value.email,
        password: form.value.password,
      })
    } else {
      await register({
        email: form.value.email,
        password: form.value.password,
        name: form.value.name,
      })
    }

    // Redirection après connexion réussie
    router.push('/dashboard')
  } catch (err) {
    // L'erreur est déjà gérée dans le composable
    console.error('Authentication error:', err)
  }
}

const toggleMode = () => {
  isLoginMode.value = !isLoginMode.value
  form.value = { email: '', password: '', name: '' }
}
</script>

<template>
  <div class="auth-container">
    <div class="auth-card">
      <h1>{{ isLoginMode ? 'Connexion' : 'Inscription' }}</h1>

      <form @submit.prevent="handleSubmit">
        <div v-if="!isLoginMode" class="form-group">
          <label for="name">Nom</label>
          <input id="name" v-model="form.name" type="text" required placeholder="John Doe" />
        </div>

        <div class="form-group">
          <label for="email">Email</label>
          <input
            id="email"
            v-model="form.email"
            type="email"
            required
            placeholder="john@example.com"
          />
        </div>

        <div class="form-group">
          <label for="password">Mot de passe</label>
          <input
            id="password"
            v-model="form.password"
            type="password"
            required
            minlength="8"
            placeholder="********"
          />
        </div>

        <div v-if="error" class="error-message">
          {{ error }}
        </div>

        <button type="submit" :disabled="loading" class="submit-btn">
          {{ loading ? 'Chargement...' : isLoginMode ? 'Se connecter' : "S'inscrire" }}
        </button>
      </form>

      <div class="toggle-mode">
        <button @click="toggleMode" type="button">
          {{ isLoginMode ? "Pas encore de compte ? S'inscrire" : 'Déjà un compte ? Se connecter' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 2rem;
}

.auth-card {
  background: white;
  border-radius: 1rem;
  padding: 2rem;
  max-width: 400px;
  width: 100%;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

h1 {
  margin-bottom: 2rem;
  text-align: center;
  color: #333;
}

.form-group {
  margin-bottom: 1.5rem;
}

label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #555;
}

input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 0.5rem;
  font-size: 1rem;
  transition: border-color 0.3s;
}

input:focus {
  outline: none;
  border-color: #4f46e5;
}

.error-message {
  padding: 0.75rem;
  background-color: #fee;
  border: 1px solid #fcc;
  border-radius: 0.5rem;
  color: #c33;
  margin-bottom: 1rem;
  font-size: 0.875rem;
}

.submit-btn {
  width: 100%;
  padding: 0.875rem;
  background-color: #4f46e5;
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.3s;
}

.submit-btn:hover:not(:disabled) {
  background-color: #4338ca;
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.toggle-mode {
  margin-top: 1.5rem;
  text-align: center;
}

.toggle-mode button {
  background: none;
  border: none;
  color: #4f46e5;
  cursor: pointer;
  text-decoration: underline;
  font-size: 0.875rem;
}

.toggle-mode button:hover {
  color: #4338ca;
}
</style>
