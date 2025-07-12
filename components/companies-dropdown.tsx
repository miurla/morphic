'use client'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { createClient } from '@/lib/supabase/client'
import { Building2, ChevronDown, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface Company {
  id: string
  name: string
  description?: string
  industry?: string
  priority?: number
  is_active?: boolean
  status?: string
}

export function CompaniesDropdown() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('main_companies')
          .select(
            'id, name, description, industry, priority, is_active, status'
          )
          .eq('is_active', true)
          .order('priority', { ascending: false })
          .order('name')

        if (error) {
          console.error('Error fetching companies:', error)
        } else {
          setCompanies(data || [])
        }
      } catch (error) {
        console.error('Error fetching companies:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchCompanies()
  }, [])

  const handleCompanySelect = (companyName: string) => {
    setIsOpen(false)
    // Navigate to search with the company name as the query
    router.push(`/?q=${encodeURIComponent(companyName)}`)
  }

  if (isLoading) {
    return (
      <Button variant="outline" disabled className="w-full justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="size-4" />
          <span>Companies</span>
        </div>
        <Loader2 className="size-4 animate-spin" />
      </Button>
    )
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="size-4" />
            <span>Companies</span>
          </div>
          <ChevronDown className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="start">
        {companies.length === 0 ? (
          <DropdownMenuItem disabled>
            No active companies found
          </DropdownMenuItem>
        ) : (
          companies.map(company => (
            <DropdownMenuItem
              key={company.id}
              onClick={() => handleCompanySelect(company.name)}
              className="cursor-pointer"
            >
              <div className="flex flex-col w-full">
                <div className="flex items-center justify-between">
                  <span className="font-medium truncate">{company.name}</span>
                  {company.priority && (
                    <span className="text-xs text-muted-foreground ml-2">
                      P{company.priority}
                    </span>
                  )}
                </div>
                {company.status && (
                  <span className="text-xs text-muted-foreground">
                    {company.status}
                  </span>
                )}
              </div>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
