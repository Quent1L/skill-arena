# Schémas de Validation

Ce dossier contient les schémas de validation Zod utilisés avec vee-validate dans l'application.

## auth.schema.ts

Contient les schémas de validation pour l'authentification :

### `loginSchema`

- **email** : Email valide requis
- **password** : Minimum 8 caractères

### `registerSchema`

- **email** : Email valide requis
- **name** : Nom optionnel
- **password** : Minimum 8 caractères
- **passwordConfirm** : Doit correspondre au mot de passe

## Utilisation

```typescript
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { loginSchema } from '@/schemas/auth.schema'

const { defineField, handleSubmit, errors } = useForm({
  validationSchema: toTypedSchema(loginSchema),
})
```
