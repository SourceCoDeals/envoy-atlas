import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building, Globe, MapPin, Users, DollarSign, Calendar, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';

interface CompanyInfoProps {
  companyId: string;
}

interface Company {
  id: string;
  name: string;
  domain: string | null;
  website: string | null;
  industry: string | null;
  sub_industry: string | null;
  employee_count: number | null;
  employee_range: string | null;
  revenue: number | null;
  revenue_range: string | null;
  year_founded: number | null;
  address_city: string | null;
  address_state: string | null;
  address_country: string | null;
  description: string | null;
  linkedin_url: string | null;
}

export function CompanyInfo({ companyId }: CompanyInfoProps) {
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCompany() {
      if (!companyId) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .single();

      if (!error && data) {
        setCompany(data as Company);
      }
      setLoading(false);
    }

    fetchCompany();
  }, [companyId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  if (!company) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Building className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No company information available</p>
        </CardContent>
      </Card>
    );
  }

  const location = [company.address_city, company.address_state, company.address_country]
    .filter(Boolean)
    .join(', ');

  const infoItems = [
    { icon: Globe, label: 'Website', value: company.website || company.domain, isLink: true },
    { icon: Building, label: 'Industry', value: company.industry },
    { icon: MapPin, label: 'Location', value: location },
    { icon: Users, label: 'Employees', value: company.employee_range || (company.employee_count?.toLocaleString()) },
    { icon: DollarSign, label: 'Revenue', value: company.revenue_range },
    { icon: Calendar, label: 'Founded', value: company.year_founded?.toString() },
  ].filter(item => item.value);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            {company.name}
          </CardTitle>
          {company.linkedin_url && (
            <a
              href={company.linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              LinkedIn
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        {company.industry && (
          <Badge variant="secondary">{company.industry}</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {company.description && (
          <p className="text-sm text-muted-foreground">{company.description}</p>
        )}

        <div className="grid grid-cols-2 gap-4">
          {infoItems.map((item, index) => (
            <div key={index} className="flex items-start gap-3">
              <item.icon className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">{item.label}</p>
                {item.isLink && item.value ? (
                  <a
                    href={item.value.startsWith('http') ? item.value : `https://${item.value}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium hover:underline flex items-center gap-1"
                  >
                    {item.value}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <p className="text-sm font-medium">{item.value}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}