  $(function() {

    // Toggle when an item is selected and display the selected items on cart.

    $('#cart-num').html(sessionStorage.test);

    $('#products button i').on('click', function(e) {
      var color = $(this).hasClass('black');

      if (color === true) {
        $(this).removeClass("far fa-heart black");
        $(this).addClass("fas fa-heart red");
        var app = $(this).attr("class");
        var num = $('.fas.fa-heart.red').length;
        // sessionStorage.test = num
        // $('#cart-num').html(num);
        // console.log(app, num);
      } else if (color === false) {
        $(this).removeClass("fas fa-heart red");
        $(this).addClass("far fa-heart black");
        var app = $(this).attr("class");
        var num = $('.fas.fa-heart.red').length;
      }

    });

    // Example starter JavaScript for disabling form submissions if there are invalid fields
    (function() {
      'use strict'

      window.addEventListener('load', function() {
        // Fetch all the forms we want to apply custom Bootstrap validation styles to
        var forms = document.getElementsByClassName('needs-validation')

        // Loop over them and prevent submission
        Array.prototype.filter.call(forms, function(form) {
          form.addEventListener('submit', function(event) {
            if (form.checkValidity() === false) {
              event.preventDefault()
              event.stopPropagation()
            }

            form.classList.add('was-validated')
          }, false)
        })
      }, false)
    })()


    $('#description a').on('click', function(e) {
      e.preventDefault();
      $('#description a').removeClass('active');
      $(this).attr('class', 'active');
    });

    $('.info .away').hide();
    $('.info .descript').show();

    $('#descript').on('click', function(e) {
      $('.info .away').hide();
      $('.info .descript').show();
    });

    $('#add_info').on('click', function(e) {
      $('.info .away').hide();
      $('.info .additional_info').show();
    });

    $('#rev').on('click', function(e) {
      $('.info .away').hide();
      $('.info .review').show();
    });

    $('#promo_code').on('click', function() {
      $('.update').removeAttr('disabled');
    });

    $('#promo_code').on('focus', function() {
      $('small.val').hide();
    });

    $('#update').on('submit', function(e) {
      e.preventDefault();
      var ans = parseInt($('#totalSub').text()) * .15;
      var total = parseInt($('#totalSub').text()) - ans;

      if ($('#promo_code').val() == '2020') {

        $('small.val').html('<span>Valid promo code</span> <i class="fas fa-check"></i>');

        $('#promotion').text(-ans);
        $('#total').text(total);
        $('small.val').removeClass('red');
        $('small.val').addClass('green');
        $('small.val').show(500);
        $('#promo_code').val('')
      } else {

        $('#promotion').text('-0');
        $('#total').text($('#totalSub').text());
        $('small.val').html('<span>Invalid promo code</span> <i class="fas fa-times"></i>');
        $('small.val').removeClass('green');
        $('small.val').addClass('red');
        $('small.val').show(500);
        $('#promo_code').val('')

      }
    });

    // ADD SUBTOTAL PRICE FOR ALL ITEMS IN CART

    var arr = [];
    $('.subtotal').each(function(index) {
      arr.push(parseInt($(this).text()));
    });
    var sum = arr.reduce(function(a, b) {
      return a + b;
    }, 0)
    $('#totalSub').html(sum);

    function totalAmount() {
      return parseInt($('#totalSub').text()) + parseInt($('#promotion').text());
    }

    $('#total').html(totalAmount());

    //CREATE A SESSIONAL STRORAGE AND LOAD IT IN PAYEMENT

    $('.checkout').on('click', function(e) {
      localStorage.setTotalAmount = $('#total').text();
    });

    $('#amountTotal').html(localStorage.setTotalAmount);

    function checkPromo() {

      var arr = [];
      $('.prod').each(function(index) {
        arr.push(parseInt($(this).text()));
      });
      var sum = arr.reduce(function(a, b) {
        return a + b;
      }, 0);
      var total = $('#amountTotal').text();
      console.log(`sum: ${sum} and total: ${total}`);
      if (sum == total) {
        $('.coupon').hide();
      } else {
        console.log('yes');
      }

    }

    checkPromo();

    function grandTotal() {
      $('#grandTotal').html(parseInt($('#amountTotal').text()) + parseInt($('#shipping').text()))
      $('#grandTotalValue').val(parseInt($('#amountTotal').text()) + parseInt($('#shipping').text()))
    }

    grandTotal();

  });
