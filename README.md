QuickKit v1.0

Versão inicial estável do QuickKit.

MAIÚSCULAS, minúsculas, Primeira Letra e demais ferramentas do menu de contexto.
CopyBox com histórico local.
Favoritos e botão Copiar.
Substituição direta em campos editáveis.
Cópia do resultado em textos comuns.
Funcionamento local, sem backend.
QuickKit

Extensão Chrome Manifest V3 que combina:

RightClick Tools: selecione um texto, clique com o botão direito e use ações rápidas.
CopyBox: histórico local dos textos copiados em páginas da web.
Ferramentas no botão direito
Limpar formatação
MAIÚSCULAS
minúsculas
Primeira Letra
Remover espaços extras
Remover quebras de linha
Extrair apenas números
Extrair e-mails
Extrair links
Contar caracteres
Salvar no CopyBox
Salvar como favorito
CopyBox
Captura textos copiados em páginas web
Pesquisa instantânea
Fixar itens importantes
Excluir itens
Limpar histórico mantendo os fixados
Clique em qualquer item para copiar novamente
Botão Copiar dedicado
Sincronização com o clipboard ao abrir o popup
Tudo salvo em chrome.storage.local
Instalar localmente
Abra chrome://extensions/.
Ative Modo do desenvolvedor.
Clique em Carregar sem compactação.
Selecione a pasta quickkit-extension.
Fixe o QuickKit na barra do Chrome.
Teste rápido
Abra qualquer site comum.
Copie um texto.
Abra o QuickKit e veja o texto no histórico.
Selecione um CPF, telefone ou outro texto na página.
Clique com o botão direito > QuickKit > Extrair apenas números.
Cole em algum campo para confirmar o resultado.

Para testar transformação direta:

Escreva bruno nascimento em um campo editável.
Selecione o texto.
Clique com o botão direito > QuickKit > Primeira Letra.
O resultado deve virar Bruno Nascimento.
Privacidade

O QuickKit v1.0 não envia textos para servidor e não usa backend.

O histórico fica armazenado localmente no navegador através de chrome.storage.local.

Limitações

O Chrome não permite content scripts em algumas páginas protegidas, como:

chrome://
Chrome Web Store
algumas páginas internas do navegador

Cópias feitas nessas páginas podem não entrar automaticamente no histórico.

Após atualizar ou recarregar a extensão em modo desenvolvedor, recarregue também as abas já abertas para que o QuickKit seja reinjetado corretamente.