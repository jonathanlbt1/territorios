# 🗺️ Guia Completo: Construindo um Sistema de Gestão de Territórios

Um guia passo a passo para desenvolver uma aplicação similar ao **Territorios**, um sistema de gestão de territórios para congregações.

---

## 📋 Visão Geral da Arquitetura

```
┌─────────────────────────────────────────┐
│         CLIENTE (React + Vite)          │
│  • Interface Mobile-First               │
│  • Mapas e visualização                 │
│  • PWA com notificações push            │
└──────────────┬──────────────────────────┘
               │ HTTP/REST
┌──────────────▼──────────────────────────┐
│      SERVIDOR (Node.js + Express)       │
│  • API REST                             │
│  • Autenticação JWT                     │
│  • Notificações Push (Web Push API)     │
└──────────────┬──────────────────────────┘
               │ SQL
┌──────────────▼──────────────────────────┐
│       BANCO DE DADOS (PostgreSQL)       │
│  • Territórios, usuários, designações   │
│  • Histórico completo de trabalhos      │
└─────────────────────────────────────────┘
```

---

## 🛠️ Tecnologias Necessárias

### Frontend
- **React 18+** - Biblioteca UI
- **Vite** - Build tool moderno e rápido
- **TailwindCSS** - Framework CSS utilitário
- **React Router** - Navegação entre páginas
- **Axios** - Cliente HTTP
- **jsPDF** - Geração de PDFs
- **Lucide React** - Ícones
- **React Zoom Pan Pinch** - Zoom em mapas

### Backend
- **Node.js 18+** - Runtime JavaScript
- **Express** - Framework web
- **PostgreSQL 17** - Banco de dados relacional
- **pg** - Driver PostgreSQL para Node.js
- **jsonwebtoken** - Autenticação JWT
- **bcryptjs** - Hash de senhas
- **web-push** - Notificações push
- **multer** - Upload de arquivos

### DevOps
- **Docker & Docker Compose** - Containerização


---

## 📚 PARTE 1: Configuração Inicial do Projeto

### Faça o fork deste repositório

```bash
git clone git@github.com:jonathanlbt1/territorios.git
```

## 🔧 PARTE 1: Configuração do Client

### Entre na pasta client e prossiga com os seguintes comandos em seu terminal:

```bash
npm install \
  axios \
  react-router-dom \
  react-zoom-pan-pinch \
  jspdf \
  jspdf-autotable \
  date-fns \
  lucide-react \
  tailwindcss \
  autoprefixer \
  postcss

npm install -D \
  vite-plugin-pwa \
  @types/react \
  @types/react-dom
```

### Estrutura das Pastas do Frontend

```
src/
├── components/        # Componentes reutilizáveis
│   ├── Layout.jsx
│   ├── Modal.jsx
│   ├── MapViewer.jsx
│   └── ...
├── pages/            # Páginas da aplicação
│   ├── Login.jsx
│   ├── admin/        # Páginas administrativas
│   └── dirigente/    # Páginas de dirigentes
├── contexts/         # Context API para estados globais
│   ├── AuthContext.jsx
│   ├── ThemeContext.jsx
│   └── ToastContext.jsx
├── hooks/           # Custom hooks
│   └── usePushNotifications.js
├── services/        # Serviços e integrações
│   ├── api.js       # Chamadas à API
│   └── pushNotifications.js
├── utils/           # Funções utilitárias
│   └── mapUrl.js
├── App.jsx          # Componente raiz
├── main.jsx         # Ponto de entrada
└── index.css        # Estilos globais
```


## 🔧 PARTE 2: Configuração do Server

### Estruturar Pastas do Backend

```
server/
├── src/
│   ├── index.js              # Ponto de entrada
│   ├── db/
│   │   ├── config.js         # Configuração do PostgreSQL
│   │   └── migrate.js        # Script de migrations
│   ├── middleware/
│   │   └── auth.js           # Autenticação JWT
│   ├── routes/
│   │   ├── auth.js
│   │   ├── territories.js
│   │   ├── assignments.js
│   │   ├── users.js
│   │   ├── reports.js
│   │   ├── maps.js
│   │   └── push.js
│   ├── services/
│   │   ├── notificationService.js
│   │   └── pushNotification.js
│   ├── utils/
│   │   ├── generateUsername.js
│   │   └── generateVapidKeys.js
│   └── jobs/
│       └── overdueNotifier.js  # Job para notificações automáticas
├── png_files/                # Imagens dos territórios
├── Dockerfile
└── package.json
```

### Configurar Variáveis de Ambiente

Criar `.env`:
```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=nosso_territorio
DB_USER=postgres
DB_PASSWORD=senha123

# Authentication
JWT_SECRET=sua-chave-super-secreta-aqui
JWT_EXPIRES_IN=7d

# Server
PORT=3001
NODE_ENV=development

# Push Notifications
VAPID_PUBLIC_KEY=sua-chave-publica
VAPID_PRIVATE_KEY=sua-chave-privada
```

### Configurar Cartões de Território

Tire uma cópia digital no formato .png dos cartões de cada território e salve-os na pasta server/png_files. Sugiro usar a numeração do territorio como nome do arquivo. Por exemplo ter_001.png. Adicione também nesta pasta o arquivo do mapa do território com o nome ter_geral.png. 


### Configurar Push Notifications

Entre nesta pasta do server, e rode este comando para gerar suas chaves VAPID:

**Gerar VAPID Keys:**
```bash
node src/utils/generateVapidKeys.js
```

Guarde elas pois você precisará delas ao subir a aplicação em seu ambiente.


## 🐳 Containerização

### Passo 5.1: Criar Dockerfile do Cliente

Já existem arquivos docker para o server e client, bem como um arquivo docker-compose.yml na raiz do projeto para subir a aplicação localmente a fim de testá-la. 

Você poderá usar estes arquivos docker em seu ambiente de produção para simplificar o processo. 

O Docker compose sobe um banco de dados no docker e poderá ser destruido quando a imagem for removida. Se quiser ter um ambiente em dev onde os dados seriam persistidos, eu aconselho a baixar o Postgres 17+, criar um banco territorios_db e migrar os dados.

---

## 📚 Recursos Úteis

- [React Docs](https://react.dev)
- [Express Docs](https://expressjs.com)
- [PostgreSQL Docs](https://www.postgresql.org/docs)
- [Vite Guide](https://vitejs.dev)
- [TailwindCSS Docs](https://tailwindcss.com)
- [JWT.io](https://jwt.io)
- [Web Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)

---

## 🤝 Boas Práticas

1. **Commit Messages Claros**: Use conventional commits
2. **Code Reviews**: Sempre revise antes de merge
3. **Documentation**: Documente features importantes
4. **Environment Variables**: Separe configs por ambiente
5. **Error Handling**: Trate erros graciosamente
6. **Testing**: Escreva testes enquanto desenvolve
7. **Performance**: Use lazy loading e code splitting
8. **Segurança**: Valide sempre inputs, use HTTPS
9. **Monitoring**: Registre erros e performance
10. **User Experience**: Feedback claro ao usuário

---

**Se desejar ajudar com o desenvolvimento deste projeto, sinta-se a vontade para me contatar**
