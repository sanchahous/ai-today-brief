'use client';

import { useState } from 'react';
import { AccessiblePagination, LinkTabs } from '@/components/ui';
import { Breadcrumbs } from '@/components/breadcrumbs';
import type { Lang } from '@/lib/site';

const COPY = {
  en: {
    title: 'Navigation: Pagination, Tabs, Breadcrumbs',
    paginationInteractive: 'Interactive pagination',
    paginationStart: 'Start (page 1 - prev disabled)',
    paginationEnd: 'End (page 5 of 5 - next disabled)',
    linkTabs: 'Link-tabs (URL state)',
    all: 'All',
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
    breadcrumbs: 'Breadcrumbs',
    home: 'Home',
    news: 'News',
    category: 'Agents & MCP',
    article: 'Building Autonomous AI Coding Agents with Tool Use and Sandboxing',
    activePage: 'Current page',
    selectedTab: 'Active link tab',
  },
  uk: {
    title: 'Навігація: Pagination, Tabs, Breadcrumbs',
    paginationInteractive: 'Інтерактивна пагінація',
    paginationStart: 'Початок (сторінка 1 - назад вимкнено)',
    paginationEnd: 'Кінець (сторінка 5 з 5 - далі вимкнено)',
    linkTabs: 'Link-tabs (стан URL)',
    all: 'Усі',
    daily: 'Щоденні',
    weekly: 'Тижневі',
    monthly: 'Місячні',
    breadcrumbs: 'Хлібні крихти',
    home: 'Головна',
    news: 'Новини',
    category: 'Агенти й MCP',
    article: 'Побудова автономних агентів для написання коду з використанням інструментів',
    activePage: 'Поточна сторінка',
    selectedTab: 'Активна вкладка-посилання',
  },
};

export function NavigationCatalog() {
  const [lang, setLang] = useState<Lang>('en');
  const [page, setPage] = useState(2);
  const [activeLinkTab, setActiveLinkTab] = useState('all');

  const t = COPY[lang];

  return (
    <section
      id="navigation-catalog"
      data-testid="navigation-catalog"
      aria-labelledby="navigation-catalog-title"
      className="border-line border-t py-8"
      lang={lang}
    >
      <h2 id="navigation-catalog-title" className="mb-4 font-serif text-xl">
        {t.title}
      </h2>

      {/* Language toggle */}
      <div className="mb-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setLang('en')}
          className={`min-h-[44px] rounded-full px-4 text-sm font-medium transition ${
            lang === 'en' ? 'bg-text text-bg font-bold' : 'border-line text-muted border'
          }`}
        >
          EN
        </button>
        <button
          type="button"
          onClick={() => setLang('uk')}
          className={`min-h-[44px] rounded-full px-4 text-sm font-medium transition ${
            lang === 'uk' ? 'bg-text text-bg font-bold' : 'border-line text-muted border'
          }`}
        >
          UK
        </button>
      </div>

      {/* 1. Interactive Pagination */}
      <div className="mb-8">
        <h3 className="mb-2 text-base font-semibold">{t.paginationInteractive}</h3>
        <p data-testid="catalog-pagination-active" className="text-muted text-sm">
          {t.activePage}: {page}
        </p>
        <AccessiblePagination
          page={page}
          pageCount={10}
          onPageChange={setPage}
          getPageHref={(p) => `#page-${p}`}
          prevLabel={lang === 'en' ? 'Previous' : 'Назад'}
          nextLabel={lang === 'en' ? 'Next' : 'Далі'}
          ariaLabel={lang === 'en' ? 'Catalog pagination' : 'Пагінація каталогу'}
        />
      </div>

      {/* 2. Pagination Extremes (First and Last) */}
      <div className="mb-8 grid gap-6 sm:grid-cols-2">
        <div data-testid="catalog-pagination-start">
          <h4 className="text-muted mb-2 text-sm font-medium">{t.paginationStart}</h4>
          <AccessiblePagination
            page={1}
            pageCount={5}
            onPageChange={() => {}}
            getPageHref={(p) => `#start-${p}`}
            prevLabel={lang === 'en' ? 'Previous' : 'Назад'}
            nextLabel={lang === 'en' ? 'Next' : 'Далі'}
          />
        </div>
        <div data-testid="catalog-pagination-end">
          <h4 className="text-muted mb-2 text-sm font-medium">{t.paginationEnd}</h4>
          <AccessiblePagination
            page={5}
            pageCount={5}
            onPageChange={() => {}}
            getPageHref={(p) => `#end-${p}`}
            prevLabel={lang === 'en' ? 'Previous' : 'Назад'}
            nextLabel={lang === 'en' ? 'Next' : 'Далі'}
          />
        </div>
      </div>

      {/* 3. LinkTabs (URL-state navigation tabs) */}
      <div className="mb-8">
        <h3 className="mb-2 text-base font-semibold">{t.linkTabs}</h3>
        <p data-testid="catalog-linktabs-active" className="text-muted mb-3 text-sm">
          {t.selectedTab}: {activeLinkTab}
        </p>
        <LinkTabs
          ariaLabel={t.linkTabs}
          activeTabId={activeLinkTab}
          onTabClick={(e, tab) => {
            e.preventDefault();
            setActiveLinkTab(tab.id);
          }}
          tabs={[
            { id: 'all', label: t.all, href: '#digests', count: 42 },
            { id: 'daily', label: t.daily, href: '#daily', count: 35 },
            { id: 'weekly', label: t.weekly, href: '#weekly', count: 7 },
            { id: 'monthly', label: t.monthly, href: '#monthly' },
          ]}
        />
      </div>

      {/* 4. Breadcrumbs */}
      <div className="mb-4" data-testid="catalog-breadcrumbs">
        <h3 className="mb-2 text-base font-semibold">{t.breadcrumbs}</h3>
        <Breadcrumbs
          items={[
            { label: t.home, href: `/${lang}` },
            { label: t.news, href: `/${lang}/news` },
            { label: t.category, href: `/${lang}/category/agents-and-mcp` },
            { label: t.article },
          ]}
        />
      </div>
    </section>
  );
}
