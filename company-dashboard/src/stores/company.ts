import { create } from 'zustand'

interface Company {
  id: string
  name: string
}

interface CompanyStore {
  companies: Company[]
  activeCompanyId: string | null // null = HD (all)
  setCompanies: (companies: Company[]) => void
  setActiveCompany: (id: string | null) => void
}

export const useCompanyStore = create<CompanyStore>((set) => ({
  companies: [],
  activeCompanyId: null,
  setCompanies: (companies) => set({ companies }),
  setActiveCompany: (id) => set({ activeCompanyId: id }),
}))
