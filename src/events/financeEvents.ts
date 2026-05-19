export const movementsChangedEvent = 'finance:movements-changed'
export const categoriesChangedEvent = 'finance:categories-changed'
export const budgetsChangedEvent = 'finance:budgets-changed'

export function notifyMovementsChanged() {
  window.dispatchEvent(new CustomEvent(movementsChangedEvent))
}

export function notifyCategoriesChanged() {
  window.dispatchEvent(new CustomEvent(categoriesChangedEvent))
}

export function notifyBudgetsChanged() {
  window.dispatchEvent(new CustomEvent(budgetsChangedEvent))
}
