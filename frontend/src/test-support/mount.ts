import { mount, RouterLinkStub, type ComponentMountingOptions } from '@vue/test-utils'
import type { Component } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import ConfirmationService from 'primevue/confirmationservice'

/**
 * Mounts a component with the plugins PrimeVue components need in jsdom
 * (auto-imported PrimeVue components throw without the $primevue config).
 */
export function mountWithPrime<C extends Component>(
  component: C,
  options: ComponentMountingOptions<C> = {},
) {
  const { global: globalOptions, ...rest } = options
  return mount(component, {
    ...rest,
    global: {
      ...globalOptions,
      plugins: [
        PrimeVue,
        ToastService,
        ConfirmationService,
        createPinia(),
        ...(globalOptions?.plugins ?? []),
      ],
      stubs: {
        RouterLink: RouterLinkStub,
        ...(globalOptions?.stubs as Record<string, unknown> | undefined),
      },
    },
  })
}
