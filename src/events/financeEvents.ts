export const movementsChangedEvent = 'finance:movements-changed'
export const categoriesChangedEvent = 'finance:categories-changed'
export const budgetsChangedEvent = 'finance:budgets-changed'
export const accountsChangedEvent = 'finance:accounts-changed'
export const debtsChangedEvent = 'finance:debts-changed'

export function notifyMovementsChanged() {
  window.dispatchEvent(new CustomEvent(movementsChangedEvent))
}

export function notifyCategoriesChanged() {
  window.dispatchEvent(new CustomEvent(categoriesChangedEvent))
}

export function notifyBudgetsChanged() {
  window.dispatchEvent(new CustomEvent(budgetsChangedEvent))
}

export function notifyAccountsChanged() {
  window.dispatchEvent(new CustomEvent(accountsChangedEvent))
}

export function notifyDebtsChanged() {
  window.dispatchEvent(new CustomEvent(debtsChangedEvent))
}
