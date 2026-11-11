# PARIS — PWA de consulta offline (interface pública, dados locais)

## Finalidade e arquitetura
Este diretório contém apenas HTML, CSS, JavaScript, ícone e manifest da interface genérica de consulta offline. **Nenhum dado financeiro, cópia da base, credencial ou token corporativo é armazenado no GitHub Pages.** O conteúdo importado pelo usuário permanece no IndexedDB do navegador/PWA do dispositivo.

O PARIS corporativo continua online e é sempre a fonte oficial. Esta PWA serve apenas para visualizar a última cópia manualmente importada, em modo somente leitura.

## Uso no iPhone
1. Abra `https://idquerido.github.io/paris-offline/` no Safari enquanto estiver conectado.
2. Em Compartilhar, selecione Adicionar à Tela de Início.
3. Abra o aplicativo instalado pelo novo ícone e deixe-o carregar uma vez com internet.
4. No PARIS online, clique Baixar offline e salve o HTML em Arquivos.
5. No PWA instalado, toque Selecionar arquivo do PARIS, importe o HTML e escolha Consultar cópia.
6. Sem internet, abra o ícone instalado e consulte a cópia.
7. Para atualizar, importe um novo HTML; para excluir, use Excluir cópia.
8. Exclua separadamente o HTML original em Arquivos/Downloads se quiser remover todas as cópias locais.

## Segurança e limitações
- Sem sincronização automática, sem escrita remota, sem edição ou acesso ao Google Sheets.
- Service worker armazena somente os recursos estáticos do shell (não arquivos financeiros).
- Dados locais limitados a uma cópia; cada instalação/navegador possui seu próprio armazenamento.
- HTML importado validado estruturalmente, limitado a 20 MB, exibido em iframe com origem opaca, sandbox sem acesso ao pai, e CSP que bloqueia conexões de rede.
- O armazenamento local pode ser limpo pelo sistema; não é garantia de arquivamento permanente.
- A exclusão no PWA não remove o arquivo originalmente baixado.
- O iOS pode separar o armazenamento da versão Safari do armazenamento do PWA instalado. Importe sempre dentro da versão instalada.

## Testes
Realizados testes locais com arquivo demonstrativo sem dados reais: importação, renderização das cinco guias e exclusão. Ainda é necessário validar diretamente no iPhone a instalação, abertura em modo avião, seleção do arquivo real e persistência após fechar/reabrir.

Não se deve declarar a PWA plenamente aprovada antes desse teste em dispositivo real.
