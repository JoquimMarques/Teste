# Como Atualizar a Versão do Sistema

## Quando fazer um deploy de nova versão:

1. **Atualizar `version.json`**:
   - Altere o número da `version` ou incremente o `build`
   - Atualize a data em `updated`

2. **Atualizar `sw.js`**:
   - Altere o `CACHE_NAME` para a nova versão
   - Altere a constante `APP_VERSION` para a mesma versão do `version.json`

3. **Atualizar `src/js/script-corrected.js`**:
   - Altere a constante `APP_VERSION` na linha onde está definida (procure por `const APP_VERSION`)

## Exemplo de Atualização:

### version.json:
```json
{
  "version": "1.0.1",
  "build": 2,
  "updated": "2024-01-15T10:30:00Z"
}
```

### sw.js:
```javascript
const CACHE_NAME = 'briolink-v1.0.1';
const APP_VERSION = '1.0.1';
```

### script-corrected.js:
```javascript
const APP_VERSION = '1.0.1';
```

## Como Funciona:

- O sistema verifica automaticamente a cada 5 minutos se há uma nova versão
- Quando detecta diferença, força o usuário a atualizar
- Limpa os caches antigos automaticamente
- Não apaga os dados do localStorage (conversas, preferências, etc.)

## Dica:

Para forçar atualização imediata após deploy, faça commit no Git e os usuários serão notificados automaticamente nos próximos 5 minutos.

