# Pátio — demonstração clicável

Protótipo em **HTML, CSS e JavaScript puros**: sem servidor, sem banco, sem instalação. Tudo roda no navegador de quem abre a página, com **dados 100% fictícios** guardados no próprio navegador (`localStorage`). Serve para ver como o Pátio funciona sem rodar o sistema real.

## O que dá para ver e fazer

- **Hoje:** quem espera a primeira resposta (com o relógio do prazo), retornos vencidos, leads parados e, para o dono, os indicadores.
- **Simulador de portal de anúncios** (marca fictícia “AutoPortal”, claramente rotulada como simulação): escolha um carro, envie “Tenho interesse” e veja o lead **chegar ao Pátio** com a origem, o veículo e a conversa. Telefone repetido não cria lead duplicado.
- **Ver como:** troque entre **dono** e **vendedores** no seletor do menu. O vendedor não vê custo nem margem; só o dono aprova descontos e vê os contratos de todos.
- **Negociação:** o vendedor propõe um preço e o aviso mostra, ao vivo, se cabe na alçada de desconto; abaixo dela vira **pedido de menor preço**. Troque para o dono, aprove ou faça contraproposta, e volte ao vendedor para fechar a venda (abaixo do aprovado, o sistema recusa).
- **Contrato livre:** até 10 modelos de texto livre por loja, com campos opcionais (`{comprador_nome}`, `{valor_extenso}`…). Gere o contrato de uma venda, com CPF validado, valor por extenso, e **imprima ou salve em PDF**.
- **Reiniciar demonstração** devolve os dados originais.

## Limites (leia antes de tirar conclusões)

- **Não é o sistema real.** Não há conta, segurança, banco de dados nem integração: WhatsApp, portais e FIPE são simulados. Os dados somem se você limpar os dados do navegador.
- As **regras de negócio** (telefone, valores, margem, alçada, valor por extenso, CPF/CNPJ) são as mesmas do sistema real, portadas para JavaScript e conferidas com os mesmos casos de teste.
- O texto de contrato de exemplo é genérico e **não tem validade jurídica garantida**.

## Rodar localmente

```powershell
cd demo
py -m http.server 8200      # ou qualquer servidor estático; abrir http://localhost:8200
node --test tests/rules.test.mjs   # testes das regras (Node 20+)
```

Abrir `index.html` direto do disco não funciona (módulos ES exigem servidor HTTP). No GitHub Pages funciona normalmente.

## Verificação

`tests/rules.test.mjs`: regras com resultados conhecidos (os mesmos do backend Python). `tests/e2e.mjs`: roteiro completo no Chrome (desktop e celular) que cobre o portal, o rodízio, a alçada, a aprovação, a venda, o contrato, o limite de 10 modelos, a proteção contra HTML digitado, a persistência e o reinício (`node demo/tests/e2e.mjs http://localhost:8200/`; requer Playwright com Chrome).
