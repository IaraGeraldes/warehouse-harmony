# 📑 README do Projeto — Motor de Alocação Argos

Este documento apresenta as especificações do **Argos**, um sistema inteligente e integrado de alocação de contêineres que conecta uma interface de usuário rica e interativa a um banco de dados estruturado em planilha, utilizando automação em nuvem para tomada de decisões logísticas automáticas de distribuição espacial.

---

## 💻 1. Visão Geral do Projeto

O objetivo do sistema é automatizar a triagem e direcionamento de cargas que chegam a um terminal portuário ou de armazenagem, calculando a posição ideal (andar e setor) com base em regras rígidas de segurança (cargas perigosas/IMO) e de engenharia mecânica (peso da carga).

O ecossistema é composto por três pilares fundamentais:

1. **Frontend (Lovable):** Interface rica com o usuário (Gêmeo Digital) responsável pela captação dos dados de entrada do contêiner e exibição visual do resultado de alocação recomendado.
2. **Back-end de Integração & Lógica (Make):** Motor de decisão que atua como orquestrador de microsserviços via Webhook, responsável por filtrar, converter os dados de entrada e direcionar as cargas de forma automática.
3. **Banco de Dados & Regras (Google Sheets):** Planilhas automatizadas que servem como armazenamento definitivo (banco de dados) e realizam cálculos lógicos de andares ideais.

---

## ⚙️ 2. Arquitetura da Solução e Fluxo de Dados

O fluxo de dados ocorre em tempo real de ponta a ponta seguindo o diagrama lógico abaixo:

```text
[ Lovable UI ] ──(Webhook HTTP POST)──> [ Make (Orquestrador) ] 
                                                 │
                                                 ▼
                                       [ Google Sheets (Busca de Vaga) ]
                                                 │
                                                 ▼
                                        [ Router (Make) ]
                                                 │
                  ┌──────────────────────────────┼──────────────────────────────┐
                  ▼ (Filtro 1: IMO)              ▼ (Filtro 2: Pesado)           ▼ (Filtro 3: Leve)
         [ Google Sheets 9 ]            [ Google Sheets 10 ]           [ Google Sheets 11 ]

```

### Detalhamento do Fluxo:

1. O usuário preenche os dados do contêiner no **Lovable** (Descrição, Peso, Estadia e se é Carga Perigosa).
2. O Lovable envia uma requisição `HTTP POST` via Webhook contendo uma carga estruturada em JSON para o **Make**.
3. O **Make** recebe os dados e faz uma consulta rápida no **Google Sheets** para pegar a célula que contém a vaga pré-calculada pelo motor do Argos.
4. O **Router** do Make aplica filtros de exclusão mútua e decide, em milissegundos, qual é o destino final do registro para persistência no banco de dados.

---

## 🎛️ 3. Regras de Negócio e Filtros de Roteamento

O roteador do Make direciona as cargas com base nas seguintes variáveis estruturadas recebidas do frontend:

* `container_description` *(string)*: Nome/Descrição identificadora da carga.
* `weight_tons` *(number)*: Peso bruto em toneladas (recebido do formulário limpo, pronto para contas matemáticas).
* `dangerous_goods_imo` *(boolean)*: Marcador lógico indicando se a carga é perigosa (`true` ou `false`).

### Rotas e Filtros Aplicados:

#### **Rota 1: É IMO? (Direcionado para Planilha 9)**

* **Finalidade:** Cargas perigosas que requerem isolamento específico de segurança por conta de inflamabilidade ou reatividade química.
* **Regra do Filtro:** `dangerous_goods_imo` é igual a `true`.

#### **Rota 2: Pesado? (Direcionado para Planilha 10)**

* **Finalidade:** Cargas comuns (Não-IMO) que possuem peso estrutural elevado e precisam ser alocadas nos andares de base (Andares de 1 a 3) para estabilidade física do empilhamento.
* **Regra do Filtro:** `weight_tons` é maior que `24` **AND** `dangerous_goods_imo` é igual a `false`.

#### **Rota 3: Leve? (Direcionado para Planilha 11)**

* **Finalidade:** Cargas comuns e leves que podem subir para os andares mais altos da estrutura física do pátio de contêineres sem comprometer o centro de gravidade das pilhas.
* **Regra do Filtro:** `weight_tons` é menor ou igual a `24` **AND** `dangerous_goods_imo` é igual a `false`.

---

## 🛠️ 4. Principais Tecnologias Utilizadas

* **Frontend Web App:** React / TailwindCSS compilado através da plataforma **Lovable**.
* **Cloud Integrator & iPaaS:** **Make** (anteriormente Integromat) para criação do fluxo lógico `no-code`/`low-code`.
* **Database / Data Store:** **Google Sheets** agindo como planilha estruturada de dados.
* **Protocolo de Comunicação:** Webhooks assíncronos baseados em `REST / JSON`.

---

## 📝 5. Lições Aprendidas e Resolução de Problemas (Debugging)

Durante a fase de homologação e testes, três grandes gargalos de desenvolvimento foram mapeados e resolvidos:

1. **Tipagem de Variáveis (String vs Number):** O campo de peso vinha acompanhado da string `" t"` (ex: `"28 t"`), o que quebrava operadores matemáticos de maior/menor no Make. A solução foi ajustar o envio no frontend para entregar a variável `weight_tons` purificada como formato numérico (`28`).
2. **Mapeamento de Booleans vs Textos Literais:** Inicialmente o filtro esperava pelo texto literal `"SIM"` ou `"NÃO"`, enquanto o formulário moderno do Lovable enviava tipos booleanos nativos (`true`/`false`). Os filtros do Make foram reestruturados para ler `true` e `false` de forma segura.
3. **Configuração de Rotas de Fallback:** O uso incorreto do parâmetro *Fallback* no Router do Make causava atropelamento lógico de cargas leves. O desvio genérico foi desativado e substituído por uma regra explícita matemática de limite de peso (`<= 24`).

---

## 🚀 6. Como Executar e Testar o Sistema

1. Acesse a interface do **Gêmeo Digital (Lovable)**.
2. Insira uma descrição para o contêiner de teste.
3. Configure os valores (ex: Peso: `28`, Carga Perigosa: `Sim - IMO`).
4. Certifique-se de que o cenário do Make está em modo de escuta ativa (`Run once` ou `Scheduling: ON`).
5. Clique em **Calcular Alocação Inteligente**.
6. Abra a sua planilha do **Google Sheets** correspondente e veja a linha ser inserida instantaneamente com o registro em tempo real.

---

*Desenvolvido com foco em escalabilidade, agilidade portuária e eficiência logística.*
