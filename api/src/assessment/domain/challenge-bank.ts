// Mini-retos curados: respuesta verificable y puntuación determinista (plan §5.2).
// La respuesta correcta nunca sale de la API (ver toPublicQuestion).
export interface Challenge {
  id: string;
  skill: string;
  difficulty: 1 | 2 | 3;
  prompt: string;
  code?: string;
  language?: string;
  options: { id: string; label: string }[];
  correctOptionId: string;
}

const c = (
  id: string,
  skill: string,
  difficulty: 1 | 2 | 3,
  prompt: string,
  options: string[],
  correctIndex: number,
  code?: string,
  language?: string,
): Challenge => ({
  id,
  skill,
  difficulty,
  prompt,
  code,
  language,
  options: options.map((label, i) => ({
    id: String.fromCharCode(97 + i),
    label,
  })),
  correctOptionId: String.fromCharCode(97 + correctIndex),
});

export const CHALLENGES: readonly Challenge[] = [
  // Fundamentos
  c(
    'pb-1',
    'programming-basics',
    1,
    '¿Qué se imprime?',
    ['A', 'B', 'AB', 'Nada'],
    0,
    'x = 3\nsi x > 2 entonces\n  imprimir("A")\nsino\n  imprimir("B")',
    'text',
  ),
  c(
    'pb-2',
    'programming-basics',
    2,
    '¿Cuánto vale `total` al final?',
    ['4', '6', '10', '15'],
    2,
    'total = 0\npara i desde 1 hasta 4\n  total = total + i',
    'text',
  ),
  c(
    'pb-3',
    'programming-basics',
    3,
    '¿Qué devuelve `f(4)`?',
    ['4', '10', '24', 'Se queda en bucle infinito'],
    2,
    'función f(n)\n  si n <= 1 devolver 1\n  devolver n * f(n - 1)',
    'text',
  ),

  // JavaScript
  c(
    'js-1',
    'javascript',
    1,
    '¿Qué imprime esta línea?',
    ['"array"', '"object"', '"list"', 'undefined'],
    1,
    'console.log(typeof [])',
    'javascript',
  ),
  c(
    'js-2',
    'javascript',
    2,
    '¿Qué imprime?',
    ['[2, 4, 6]', '[4, 6]', '[1, 2, 3]', '[3]'],
    1,
    'const r = [1, 2, 3].map((n) => n * 2).filter((n) => n > 2)\nconsole.log(r)',
    'javascript',
  ),
  c(
    'js-3',
    'javascript',
    3,
    '¿En qué orden se imprimen las letras?',
    ['a b c', 'c a b', 'c b a', 'b c a'],
    2,
    "setTimeout(() => console.log('a'))\nPromise.resolve().then(() => console.log('b'))\nconsole.log('c')",
    'javascript',
  ),

  // TypeScript
  c(
    'ts-1',
    'typescript',
    1,
    '¿Qué pasa al compilar?',
    [
      'Compila y x vale "5"',
      'Compila y x vale 5',
      'Error de tipos',
      'Error en tiempo de ejecución',
    ],
    2,
    'let x: number = "5"',
    'typescript',
  ),
  c(
    'ts-2',
    'typescript',
    2,
    '¿Qué tipo es `K`?',
    ['string', '"a" | "b"', '1 | 2', '{ a: 1; b: 2 }'],
    1,
    'type K = keyof { a: 1; b: 2 }',
    'typescript',
  ),
  c(
    'ts-3',
    'typescript',
    3,
    '¿Qué tipo es `T`?',
    ['"sí"', '"no"', '"sí" | "no"', 'never'],
    2,
    'type Es<X> = X extends string ? "sí" : "no"\ntype T = Es<string | number>',
    'typescript',
  ),

  // React
  c(
    'react-1',
    'react',
    1,
    '¿Qué hook guarda estado local en un componente?',
    ['useEffect', 'useState', 'useRef', 'useMemo'],
    1,
  ),
  c(
    'react-2',
    'react',
    2,
    '¿Cuándo se ejecuta este efecto?',
    [
      'En cada render',
      'Solo al montar el componente',
      'Solo al desmontarlo',
      'Nunca',
    ],
    1,
    'useEffect(() => {\n  cargarDatos()\n}, [])',
    'tsx',
  ),
  c(
    'react-3',
    'react',
    3,
    '¿Por qué React pide `key` al renderizar listas?',
    [
      'Para aplicar estilos',
      'Para identificar cada elemento entre renders',
      'Para ordenar la lista',
      'Es opcional y no tiene efecto',
    ],
    1,
  ),

  // Angular / Vue
  c(
    'ng-1',
    'angular',
    1,
    '¿Qué decorador define un componente en Angular?',
    ['@Injectable', '@NgModule', '@Component', '@Input'],
    2,
  ),
  c(
    'ng-2',
    'angular',
    2,
    'Con signals, ¿cómo cambias el valor de `count`?',
    ['count = 1', 'count.set(1)', 'count.value = 1', 'setCount(1)'],
    1,
    'const count = signal(0)',
    'typescript',
  ),
  c(
    'vue-1',
    'vue',
    1,
    'En Vue 3, ¿cómo lees el valor de `n` en el script?',
    ['n', 'n.value', 'n()', 'this.n'],
    1,
    'const n = ref(0)',
    'typescript',
  ),

  // Backend
  c(
    'node-1',
    'nodejs',
    1,
    '¿Qué módulo nativo de Node.js sirve para leer archivos?',
    ['http', 'path', 'fs', 'os'],
    2,
  ),
  c(
    'node-2',
    'nodejs',
    2,
    'En un middleware de Express, ¿qué pasa si no llamas a `next()` ni respondes?',
    [
      'Express responde 200 solo',
      'La petición se queda colgada',
      'Salta al siguiente middleware',
      'Se lanza un error',
    ],
    1,
  ),
  c(
    'sql-1',
    'sql',
    1,
    '¿Qué devuelve esta consulta?',
    [
      'Todas las filas',
      'Cuántos usuarios activos hay',
      'El primer usuario activo',
      'Un error',
    ],
    1,
    'SELECT COUNT(*) FROM users WHERE active = true;',
    'sql',
  ),
  c(
    'sql-2',
    'sql',
    2,
    'Hay 3 clientes y solo 1 tiene pedidos (2 pedidos). ¿Cuántas filas devuelve?',
    ['1', '2', '3', '4'],
    3,
    'SELECT * FROM clientes c\nLEFT JOIN pedidos p ON p.cliente_id = c.id;',
    'sql',
  ),
  c(
    'py-1',
    'python',
    1,
    '¿Qué imprime?',
    ['3', '4', '"hola"', 'Error'],
    1,
    'print(len("hola"))',
    'python',
  ),
  c(
    'py-2',
    'python',
    2,
    '¿Qué imprime?',
    ['[0, 1, 2]', '[1, 4, 9]', '[0, 1, 4]', '[0, 2, 4]'],
    2,
    'print([x * x for x in range(3)])',
    'python',
  ),
  c(
    'java-1',
    'java',
    1,
    '¿Cuánto vale `x`?',
    ['3', '3.5', '4', 'Error de compilación'],
    0,
    'int x = 7 / 2;',
    'java',
  ),
  c(
    'java-2',
    'java',
    2,
    '¿Cómo se comparan correctamente dos String por contenido?',
    ['a == b', 'a.equals(b)', 'a === b', 'a.compare(b) == true'],
    1,
  ),
  c(
    'cs-1',
    'csharp',
    1,
    '¿Cuánto vale `x`?',
    ['2', '2.5', '3', 'Error de compilación'],
    0,
    'var x = 5 / 2;',
    'csharp',
  ),
  c(
    'go-1',
    'go',
    1,
    '¿Dónde se puede usar `x := 5`?',
    [
      'En cualquier parte del archivo',
      'Solo dentro de funciones',
      'Solo en el paquete main',
      'Solo con constantes',
    ],
    1,
  ),
  c(
    'php-1',
    'php',
    1,
    '¿Con qué empiezan las variables en PHP?',
    ['@', '#', '$', '&'],
    2,
  ),

  // Móvil
  c(
    'dart-1',
    'dart',
    1,
    '¿Qué pasa con este código?',
    [
      'x pasa a valer "a"',
      'Error: x es de tipo int',
      'x vale 5 y se ignora',
      'Error en tiempo de ejecución',
    ],
    1,
    "var x = 5;\nx = 'a';",
    'dart',
  ),
  c(
    'flutter-1',
    'flutter',
    1,
    '¿Qué widget usarías si su contenido cambia con el tiempo?',
    ['StatelessWidget', 'StatefulWidget', 'InheritedWidget', 'Container'],
    1,
  ),

  // Herramientas / DevOps
  c(
    'git-1',
    'git',
    1,
    '¿Qué comando crea una rama nueva y se cambia a ella?',
    [
      'git branch',
      'git switch -c nueva',
      'git merge nueva',
      'git commit -b nueva',
    ],
    1,
  ),
  c(
    'docker-1',
    'docker',
    1,
    '¿Cuál es la relación entre imagen y contenedor?',
    [
      'Son lo mismo',
      'El contenedor es una instancia en ejecución de una imagen',
      'La imagen se crea a partir del contenedor en ejecución',
      'La imagen es el Dockerfile',
    ],
    1,
  ),
];

export const challengesFor = (skill: string) =>
  CHALLENGES.filter((ch) => ch.skill === skill).sort(
    (a, b) => a.difficulty - b.difficulty,
  );

export const SKILLS_WITH_CHALLENGES = new Set(CHALLENGES.map((ch) => ch.skill));
