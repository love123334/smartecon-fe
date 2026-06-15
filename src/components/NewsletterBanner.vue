<template>
  <section class="shop-newsletter" aria-label="Đăng ký nhận tin">
    <div class="container shop-newsletter__inner">
      <div class="shop-newsletter__copy">
        <h2>Tham gia bản tin SEDSP</h2>
        <p>Nhận tin khuyến mãi và gợi ý sản phẩm mỗi tuần.</p>
      </div>
      <form class="shop-newsletter__form" @submit.prevent>
        <label for="nl-email" class="sr-only">Email</label>
        <input id="nl-email" type="email" placeholder="email@cua-ban.com" autocomplete="email" />
        <button type="submit" class="shop-newsletter__submit btn-interactive">Đăng ký</button>
      </form>
    </div>
  </section>
</template>
