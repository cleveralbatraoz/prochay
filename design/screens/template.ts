export function element<T extends Element = HTMLElement>(root: ParentNode, selector: string): T {
  const found = root.querySelector<T>(selector)
  if (!found) throw new Error('В шаблоне отсутствует ' + selector)
  return found
}

export function templates(markup: string) {
  const container = document.createElement('template')
  container.innerHTML = markup
  return (id: string): DocumentFragment => {
    const template = element<HTMLTemplateElement>(container.content, 'template#' + id)
    return document.importNode(template.content, true)
  }
}
