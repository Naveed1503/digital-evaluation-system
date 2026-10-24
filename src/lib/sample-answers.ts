const POOL = [
  "The stack follows LIFO order. Push adds an element on top and pop removes the top element. Overflow occurs when the array is full.",
  "A binary search tree keeps smaller keys on the left subtree and larger keys on the right. Inorder traversal gives sorted output.",
  "Time complexity of quicksort is O(n log n) on average, but O(n^2) in the worst case when the pivot is always the smallest element.",
  "Hashing maps keys to indices using a hash function. Collisions can be resolved by chaining or open addressing (linear probing).",
  "Dijkstra's algorithm finds shortest paths from a source using a priority queue; it fails with negative edge weights.",
  "A queue is FIFO. Circular queues reuse empty slots by wrapping the rear pointer using modulo arithmetic.",
  "Normalization removes redundancy. 3NF requires no transitive dependency of non-key attributes on the primary key.",
];

export function makeSampleAnswers(questionNumbers: number[]) {
  return questionNumbers.map((q) => ({
    q,
    text: POOL[Math.floor(Math.random() * POOL.length)],
  }));
}
