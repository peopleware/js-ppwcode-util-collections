define(["dojo/main", "ppwcode/contracts/doh", "../StoreOfStateful"],
    function(dojo, doh, StoreOfStateful) {

      doh.register("StoreOfStateful", [

        function testConstructor() {
          var subject = new StoreOfStateful();
          doh.invars(subject);
        }

      ]);

    }
);
