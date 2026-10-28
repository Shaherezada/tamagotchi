/** Изменение количества предмета у игрока: quantity > 0; add прибавляет, take забирает. */
export interface InventoryChange {
  userId: string;
  itemId: string;
  quantity: number;
}
