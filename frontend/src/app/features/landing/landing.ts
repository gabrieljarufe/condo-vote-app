import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PublicHeader } from '../../shared/layout/public-header';
import { PublicFooter } from '../../shared/layout/public-footer';
import { FaqItem } from '../../shared/ui/faq-item';

interface Feature {
  readonly icon: string;
  readonly title: string;
  readonly description: string;
}

interface Step {
  readonly number: string;
  readonly title: string;
  readonly description: string;
}

@Component({
  selector: 'app-landing',
  imports: [RouterLink, PublicHeader, PublicFooter, FaqItem],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-public-header />

    <main class="pt-16">
      <!-- Hero -->
      <section class="bg-surface-container-lowest border-b border-outline-variant">
        <div class="max-w-7xl mx-auto px-6 py-24 lg:py-32 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed-variant text-xs font-medium mb-6">
              <span class="material-symbols-outlined text-base" aria-hidden="true" style="font-variation-settings: 'FILL' 1;">verified</span>
              Em conformidade com a Lei 14.309/22
            </span>

            <h1 class="text-4xl md:text-5xl font-bold tracking-tight text-on-surface leading-tight mb-6">
              Assembleias virtuais com
              <span class="text-secondary">segurança jurídica</span>.
            </h1>

            <p class="text-lg text-on-surface-variant max-w-lg mb-10 leading-relaxed">
              Votações online auditáveis, transparentes e fáceis de usar &mdash; do síndico ao morador.
            </p>

            <div class="flex flex-col sm:flex-row gap-3">
              <a
                routerLink="/login"
                class="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-secondary text-on-secondary font-medium hover:brightness-110 transition-all"
              >
                Começar agora
                <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
              </a>
              <a
                href="#como-funciona"
                class="inline-flex items-center justify-center px-7 py-3.5 rounded-xl border border-outline text-on-surface font-medium hover:bg-surface-container-low transition-all"
              >
                Ver como funciona
              </a>
            </div>
          </div>

          <!-- Hero illustration: SVG abstrato (sem dependência de CDN externa) -->
          <div class="hidden lg:flex justify-center items-center" aria-hidden="true">
            <svg viewBox="0 0 400 320" xmlns="http://www.w3.org/2000/svg" class="w-full max-w-md drop-shadow-xl">
              <defs>
                <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="var(--color-secondary)" stop-opacity="0.15" />
                  <stop offset="100%" stop-color="var(--color-secondary)" stop-opacity="0.04" />
                </linearGradient>
              </defs>
              <rect x="20" y="20" width="360" height="280" rx="20" fill="var(--color-surface-container-lowest)" stroke="var(--color-outline-variant)" />
              <rect x="40" y="50" width="120" height="14" rx="4" fill="var(--color-surface-container-high)" />
              <rect x="40" y="74" width="80" height="10" rx="3" fill="var(--color-surface-container)" />
              <rect x="40" y="110" width="320" height="80" rx="12" fill="url(#g1)" />
              <rect x="60" y="135" width="40" height="40" rx="8" fill="var(--color-secondary)" />
              <rect x="115" y="140" width="160" height="10" rx="3" fill="var(--color-on-surface)" />
              <rect x="115" y="160" width="100" height="8" rx="3" fill="var(--color-on-surface-variant)" />
              <rect x="40" y="210" width="156" height="60" rx="12" fill="var(--color-surface-container)" />
              <rect x="60" y="226" width="80" height="8" rx="3" fill="var(--color-on-surface-variant)" />
              <rect x="60" y="244" width="50" height="14" rx="4" fill="var(--color-secondary)" />
              <rect x="204" y="210" width="156" height="60" rx="12" fill="var(--color-surface-container)" />
              <rect x="224" y="226" width="80" height="8" rx="3" fill="var(--color-on-surface-variant)" />
              <rect x="224" y="244" width="50" height="14" rx="4" fill="var(--color-primary-container)" />
            </svg>
          </div>
        </div>
      </section>

      <!-- Funcionalidades -->
      <section id="funcionalidades" class="py-24 bg-surface">
        <div class="max-w-7xl mx-auto px-6">
          <div class="text-center mb-16 max-w-2xl mx-auto">
            <h2 class="text-3xl md:text-4xl font-semibold text-on-surface mb-4">Soluções para uma gestão moderna</h2>
            <p class="text-on-surface-variant">
              Cada voto legítimo, transparente e incontestável perante a lei brasileira.
            </p>
          </div>

          <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            @for (f of features; track f.title) {
              <article class="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant hover:shadow-md transition-shadow">
                <div class="w-12 h-12 bg-secondary-fixed text-secondary flex items-center justify-center rounded-xl mb-5">
                  <span class="material-symbols-outlined text-2xl" aria-hidden="true">{{ f.icon }}</span>
                </div>
                <h3 class="text-lg font-semibold text-on-surface mb-2">{{ f.title }}</h3>
                <p class="text-sm text-on-surface-variant leading-relaxed">{{ f.description }}</p>
              </article>
            }
          </div>
        </div>
      </section>

      <!-- Como Funciona -->
      <section id="como-funciona" class="py-24 bg-surface-container-low">
        <div class="max-w-7xl mx-auto px-6">
          <div class="text-center mb-16">
            <h2 class="text-3xl md:text-4xl font-semibold text-on-surface">Em três passos</h2>
          </div>

          <ol class="grid md:grid-cols-3 gap-10">
            @for (step of steps; track step.number) {
              <li class="text-center">
                <div class="w-14 h-14 bg-primary text-on-primary rounded-full flex items-center justify-center text-xl font-semibold mx-auto mb-5">
                  {{ step.number }}
                </div>
                <h3 class="text-lg font-semibold text-on-surface mb-3">{{ step.title }}</h3>
                <p class="text-sm text-on-surface-variant leading-relaxed max-w-xs mx-auto">{{ step.description }}</p>
              </li>
            }
          </ol>
        </div>
      </section>

      <!-- FAQ -->
      <section id="faq" class="py-24 bg-surface-container-lowest border-t border-outline-variant">
        <div class="max-w-3xl mx-auto px-6">
          <h2 class="text-3xl md:text-4xl font-semibold text-on-surface text-center mb-12">Perguntas frequentes</h2>

          <div class="flex flex-col gap-4">
            <app-faq-item question="A votação online é legalmente válida?">
              Sim. A Lei 14.309/22 autoriza assembleias virtuais em condomínios de forma permanente,
              desde que respeitados requisitos de transparência e auditoria &mdash; que nossa plataforma atende.
            </app-faq-item>

            <app-faq-item question="Como é feita a identificação do morador?">
              Autenticação via Supabase com e-mail verificado, vinculada à unidade pelo síndico.
              Cada voto é registrado com testemunha (usuário) e atribuído ao apartamento &mdash;
              alinhado ao Código Civil brasileiro.
            </app-faq-item>

            <app-faq-item question="O sistema gera a ata automaticamente?">
              Ao final da votação a plataforma consolida resultados e gera ata em PDF nos padrões
              exigidos por cartórios de registro civil, pronta para assinatura digital.
            </app-faq-item>
          </div>
        </div>
      </section>
    </main>

    <app-public-footer />
  `,
})
export default class Landing {
  protected readonly features: readonly Feature[] = [
    {
      icon: 'groups',
      title: 'Quórum facilitado',
      description: 'Aumente a participação dos moradores com votos a partir de qualquer dispositivo.',
    },
    {
      icon: 'visibility',
      title: 'Transparência',
      description: 'Auditoria em tempo real para síndicos e conselho fiscal acompanharem o processo.',
    },
    {
      icon: 'bolt',
      title: 'Facilidade',
      description: 'Interface intuitiva para todas as idades, reduzindo drasticamente o suporte técnico.',
    },
    {
      icon: 'gavel',
      title: 'Conformidade',
      description: 'Geração automática de atas e listas de presença válidas para registro em cartório.',
    },
  ];

  protected readonly steps: readonly Step[] = [
    {
      number: '1',
      title: 'Configuração',
      description: 'Importe a lista de moradores e defina a pauta da assembleia.',
    },
    {
      number: '2',
      title: 'Votação',
      description: 'Os moradores votam de forma segura via link individual.',
    },
    {
      number: '3',
      title: 'Ata gerada',
      description: 'Resultado consolidado e ata em PDF prontos para assinatura digital.',
    },
  ];
}
